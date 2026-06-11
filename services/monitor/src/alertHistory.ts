import type { AlertHistory } from './types';

interface ValuePoint {
  value: number;
  t: number;
}

const MAX_POINTS = 600; // ~10 minutes at 1Hz; cap to bound memory.

export class InMemoryAlertHistory implements AlertHistory {
  private byKey = new Map<string, ValuePoint[]>();

  lastValue(key: string): number | undefined {
    const arr = this.byKey.get(key);
    if (!arr || arr.length === 0) return undefined;
    return arr[arr.length - 1]?.value;
  }

  recordValue(key: string, value: number, t: number = Date.now()): void {
    let arr = this.byKey.get(key);
    if (!arr) {
      arr = [];
      this.byKey.set(key, arr);
    }
    arr.push({ value, t });
    if (arr.length > MAX_POINTS) {
      arr.splice(0, arr.length - MAX_POINTS);
    }
  }

  recentValues(key: string, windowMs: number): Array<{ value: number; t: number }> {
    const arr = this.byKey.get(key);
    if (!arr) return [];
    const cutoff = Date.now() - windowMs;
    const out: ValuePoint[] = [];
    for (const p of arr) {
      if (p.t >= cutoff) out.push(p);
    }
    return out;
  }

  /**
   * Compute a simple z-score over recent values vs the windowed mean/stdev.
   * Returns 0 if not enough data.
   */
  zScore(key: string, windowMs: number): number {
    const pts = this.recentValues(key, windowMs);
    if (pts.length < 5) return 0;
    const mean = pts.reduce((s, p) => s + p.value, 0) / pts.length;
    const variance = pts.reduce((s, p) => s + (p.value - mean) ** 2, 0) / pts.length;
    const stdev = Math.sqrt(variance);
    if (stdev === 0) return 0;
    const last = pts[pts.length - 1]?.value ?? 0;
    return (last - mean) / stdev;
  }

  mean(key: string, windowMs: number): number {
    const pts = this.recentValues(key, windowMs);
    if (pts.length === 0) return 0;
    return pts.reduce((s, p) => s + p.value, 0) / pts.length;
  }

  clear(): void {
    this.byKey.clear();
  }
}
