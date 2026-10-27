/**
 * Components 统一出口
 */
// --- L2 task 9: 主题/响应式/动效 组件 (新增) ---
export { default as AnimateIn } from './AnimateIn.vue'
export { default as AnimateOut } from './AnimateOut.vue'
export { default as LoadingDots } from './LoadingDots.vue'
export { default as PageTransition } from './PageTransition.vue'
export { default as MobileDrawer } from './MobileDrawer.vue'
export { default as ResponsiveGrid } from './ResponsiveGrid.vue'
export { default as MobileNav } from './MobileNav.vue'
export type { NavItem } from './MobileNav.vue.d'

// --- L2 task 6/7: 错误/Loading/Toast/Notification 组件 (原有) ---
export { default as ErrorBoundary } from './ErrorBoundary.vue'
export { default as GlobalErrorModal } from './GlobalErrorModal.vue'
export { default as InlineError } from './InlineError.vue'
export { default as FormFieldError } from './FormFieldError.vue'

export { default as LoadingPage } from './LoadingPage.vue'
export { default as LoadingSection } from './LoadingSection.vue'
export { default as LoadingTable } from './LoadingTable.vue'
export { default as LoadingButton } from './LoadingButton.vue'
export { default as LoadingForm } from './LoadingForm.vue'
export { default as LoadingInline } from './LoadingInline.vue'
export { default as LoadingModal } from './LoadingModal.vue'
export { default as LoadingDrawer } from './LoadingDrawer.vue'
export { default as Skeleton } from './Skeleton.vue'
export { default as InfiniteScroll } from './InfiniteScroll.vue'
export { default as PullToRefresh } from './PullToRefresh.vue'
export { default as UploadProgress } from './UploadProgress.vue'
export { default as ProgressBar } from './ProgressBar.vue'
export { default as IndeterminateProgress } from './IndeterminateProgress.vue'
export { default as LoadingOverlay } from './LoadingOverlay.vue'

export { default as ToastContainer } from './ToastContainer.vue'
export { default as ToastItem } from './ToastItem.vue'
export { default as ToastSuccess } from './ToastSuccess.vue'
export { default as ToastError } from './ToastError.vue'
export { default as ToastWarning } from './ToastWarning.vue'
export { default as ToastInfo } from './ToastInfo.vue'
export { default as ToastLoading } from './ToastLoading.vue'
export { default as ToastPromise } from './ToastPromise.vue'
export { default as NotificationCenter } from './NotificationCenter.vue'
export { default as NotificationItemView } from './NotificationItem.vue'

// --- 派单 47: 性能优化 图片懒加载+WebP ---
export { default as LazyImage } from './LazyImage.vue'

// --- 派单 47: Layout 统一提取 ---
export { default as AppShell } from './AppShell.vue'
export type { AppShellProps } from './AppShell.vue'
export { default as SidebarNavItem } from './SidebarNavItem.vue'

// --- S1: 配乐组件库 (Music Component Library) ---
export * from './music'
