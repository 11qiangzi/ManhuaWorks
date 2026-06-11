import type { Alert } from '../types';

export interface DedupKey {
  rule: string;
  service: string;
}

/**
 * Compute a stable dedup key for an alert.
 */
export function dedupKey(alert: Pick<Alert, 'rule' | 'service'>): string {
  return `${alert.service}::${alert.rule}`;
}

interface DedupEntry {
  fingerprint: string;
  firedAt: number;
  notifyAt: number;
  lastNotifiedAt: number;
  notifyCount: number;
  count: number;
}

/**
 * Dedup + aggregation for alerts.
 *
 * Behaviour:
 *  - First sighting fires an alert (and notifies channels immediately)
 *  - Repeated firings within `notifyIntervalMs` only bump a counter, no new notify
 *  - Re-notification happens every `notifyIntervalMs` while the alert is still firing
 *  - Resolved alerts (i.e. dropped from active) are emitted once
 */
export class AlertDedup {
  private active = new Map<string, DedupEntry>();
  private fingerprintOf: (a: Alert) => string;

  constructor(
    private notifyIntervalMs = 5 * 60 * 1000,
    fingerprintOf?: (a: Alert) => string,
  ) {
    this.fingerprintOf = fingerprintOf ?? ((a) => dedupKey(a));
  }

  /**
   * Returns:
   *  - "fire"        : new alert, should notify now
   *  - "repeat"      : alert still firing, do not notify
   *  - "re-notify"   : alert has been firing long enough to re-notify
   *  - "ignored"     : duplicate fingerprint already counted
   */
  observe(alert: Pick<Alert, 'rule' | 'service'>): 'fire' | 'repeat' | 're-notify' | 'ignored' {
    const key = this.fingerprintOf(alert as Alert);
    const existing = this.active.get(key);
    const now = Date.now();
    if (!existing) {
      this.active.set(key, {
        fingerprint: key,
        firedAt: now,
        notifyAt: now,
        lastNotifiedAt: now,
        notifyCount: 1,
        count: 1,
      });
      return 'fire';
    }
    existing.count++;
    if (existing.notifyCount === 0) {
      existing.notifyAt = now;
      existing.lastNotifiedAt = now;
      existing.notifyCount = 1;
      return 'fire';
    }
    if (now - existing.lastNotifiedAt >= this.notifyIntervalMs) {
      existing.lastNotifiedAt = now;
      existing.notifyCount++;
      return 're-notify';
    }
    return 'repeat';
  }

  /**
   * Mark alert as resolved; returns the key if it was active, undefined otherwise.
   */
  resolve(alert: Pick<Alert, 'rule' | 'service'>): string | undefined {
    const key = this.fingerprintOf(alert as Alert);
    if (this.active.has(key)) {
      this.active.delete(key);
      return key;
    }
    return undefined;
  }

  /**
   * Returns the dedup entry for a key, if any.
   */
  get(alert: Pick<Alert, 'rule' | 'service'>): DedupEntry | undefined {
    return this.active.get(this.fingerprintOf(alert as Alert));
  }

  /**
   * Snapshot of active alerts (read-only).
   */
  snapshot(): DedupEntry[] {
    return [...this.active.values()];
  }

  clear(): void {
    this.active.clear();
  }
}
