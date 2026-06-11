// =============================================================================
// test-setup-global.ts — Vitest 全局 setup（L2 林染补）
//
// 原因：apps/studio/vitest.config.ts 引用此文件（pre-existing ref），
// 但文件原本缺失，导致所有 apps/studio/tests/*.test.ts 加载失败。
// 这里只做 happy-dom 的 polyfill，不做其他副作用。
// =============================================================================

// happy-dom environment 已经由 vitest.config.ts 配置。
// 这里只预留全局扩展点（如未来需要全局 mock、polyfill、jest-dom 等）。
export {}
