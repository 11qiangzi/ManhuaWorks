// =============================================================================
// _vector-helper.ts — 共享向量工具（从 character-archetypes-v2 / scene-templates-v2 抽出）
// 仅供内部 mock/测试使用；生产应替换为 all-MiniLM-L6-v2 embedding
// =============================================================================

/** 简单字符串 hash（djb2） */
export function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/** 确定性向量生成（伪 embedding，调试/测试用） */
export function deterministicVector(text: string, dim: number, seed: number): number[] {
  const v: number[] = new Array(dim)
  let s = seed >>> 0
  for (let i = 0; i < dim; i++) {
    s = (s * 1103515245 + 12345 + i + text.charCodeAt(i % text.length)) >>> 0
    const r = (s % 20001) / 10000 - 1
    v[i] = Math.round(r * 1e4) / 1e4
  }
  return normalize(v)
}

/** L2 归一化 */
export function normalize(v: number[]): number[] {
  let s = 0
  for (const x of v) s += x * x
  const norm = Math.sqrt(s) || 1
  return v.map(x => Math.round((x / norm) * 1e4) / 1e4)
}
