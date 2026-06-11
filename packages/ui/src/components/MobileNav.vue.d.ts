/**
 * MobileNav 类型 shim
 */
declare module './MobileNav.vue' {
  export interface NavItem {
    key: string
    label: string
    icon?: string
    badge?: number | string
    to?: string
    onClick?: () => void
  }
  const _default: any
  export default _default
}

export interface NavItem {
  key: string
  label: string
  icon?: string
  badge?: number | string
  to?: string
  onClick?: () => void
}
