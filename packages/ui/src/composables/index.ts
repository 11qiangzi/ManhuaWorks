/**
 * Composables 统一出口
 */
// --- L2 task 9: 主题/响应式/动效 (新增) ---
export { useBreakpoint, DEFAULT_BREAKPOINTS } from './useBreakpoint'
export type { BreakpointName, Breakpoints, UseBreakpointReturn } from './useBreakpoint'

export { useSwipe } from './useSwipe'
export type { SwipeDirection, SwipeEvent, UseSwipeOptions, UseSwipeReturn } from './useSwipe'

export { useMediaQuery, usePrefersReducedMotion, usePrefersColorScheme } from './useMediaQuery'

export { useTheme, themeNames, STORAGE_KEY, useAppTheme, APP_THEME_LIST } from './useTheme'
export type { ThemeName, UseThemeReturn, UseAppThemeReturn } from './useTheme'
export type { AppThemeName, AppThemeMeta } from '../themes'

// --- L2 task 6/7: 错误/Loading/Toast/Notification (原有) ---
export { installGlobalErrorHandler, useErrorHandler } from './useErrorHandler'
export type { ErrorHandlerOptions } from './useErrorHandler'
export { useFormErrors } from './useFormErrors'
export type { UseFormErrorsReturn } from './useFormErrors'
export { useErrorBoundary } from './useErrorBoundary'
export type { UseErrorBoundaryReturn, ErrorBoundarySlotProps } from './useErrorBoundary'
export { useLoading } from './useLoading'
export type {
  UseLoadingReturn,
  LoadingType,
  LoadingEntry
} from './useLoading'
export { useAsyncState } from './useAsyncState'
export type { UseAsyncStateOptions, UseAsyncStateReturn } from './useAsyncState'
export { useToast } from './useToast'
export type { UseToastReturn, PromiseMessages } from './useToast'
export { useNotification } from './useNotification'
export type { UseNotificationReturn } from './useNotification'
