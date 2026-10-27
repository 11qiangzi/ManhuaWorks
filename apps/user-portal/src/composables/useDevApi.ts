/**
 * Re-export dev-portal composable so that dev-portal views
 * (DocsView, PlaygroundView, ApiKeysView, SdkView) can resolve
 * their `@/composables/useDevApi` import when loaded inside the
 * user-portal Vite context (where @ resolves to user-portal/src).
 *
 * P1-2: Merge dev-portal routes into user-portal.
 */
export * from '@dev-portal/composables/useDevApi'
