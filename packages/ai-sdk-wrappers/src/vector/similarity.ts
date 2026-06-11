/**
 * 向量相似度计算
 *
 *  - cosine  越大越相似 ∈ [-1, 1]
 *  - l2      欧氏距离，越小越相似 ∈ [0, +∞)
 *  - dot     点积，未归一化时越大越相似
 *  - cosine01 把 cosine 映射到 [0, 1] 方便阈值比较
 */

export type Metric = 'cosine' | 'l2' | 'dot' | 'cosine01';

export function dim(a: number[]): number {
  return a.length;
}

function assertSameDim(a: number[], b: number[]): void {
  if (a.length !== b.length) {
    throw new Error(`Vector dim mismatch: ${a.length} vs ${b.length}`);
  }
}

export function cosine(a: number[], b: number[]): number {
  assertSameDim(a, b);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function cosine01(a: number[], b: number[]): number {
  return (cosine(a, b) + 1) / 2;
}

export function l2(a: number[], b: number[]): number {
  assertSameDim(a, b);
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    s += d * d;
  }
  return Math.sqrt(s);
}

export function dot(a: number[], b: number[]): number {
  assertSameDim(a, b);
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    s += a[i]! * b[i]!;
  }
  return s;
}

/** L2 归一化（in-place 也可以） */
export function l2Normalize(v: number[]): number[] {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s);
  if (n === 0) return v.slice();
  return v.map((x) => x / n);
}

export function similarity(metric: Metric, a: number[], b: number[]): number {
  switch (metric) {
    case 'cosine':
      return cosine(a, b);
    case 'cosine01':
      return cosine01(a, b);
    case 'l2':
      return l2(a, b);
    case 'dot':
      return dot(a, b);
  }
}

/**
 * 找出 topK（score 大者排前）
 * 默认按 cosine01 排，metric 为 l2 时自动改为升序。
 */
export interface ScoredHit<T> {
  item: T;
  score: number;
  index: number;
}

export function topK<T>(
  query: number[],
  candidates: T[],
  vectorOf: (item: T) => number[],
  k: number,
  metric: Metric = 'cosine01',
): ScoredHit<T>[] {
  const scored: ScoredHit<T>[] = candidates.map((item, index) => ({
    item,
    index,
    score: similarity(metric, query, vectorOf(item)),
  }));
  const asc = metric === 'l2';
  scored.sort((x, y) => (asc ? x.score - y.score : y.score - x.score));
  return scored.slice(0, k);
}
