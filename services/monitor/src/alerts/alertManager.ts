import { randomUUID } from 'node:crypto';
import type { Alert, AlertChannel, AlertSeverity, RuleDefinition, RuleResult } from '../types';
import { AlertDedup } from './dedup';
import { alertsFired, alertsResolved, activeAlerts } from '../registry';

export interface AlertManagerOptions {
  /**
   * Cooldown before re-notifying a still-firing alert (default 5 minutes).
   */
  notifyIntervalMs?: number;
  /**
   * Resolved alerts older than `resolvedRetentionMs` are dropped from history.
   */
  resolvedRetentionMs?: number;
  /**
   * Suppress (mute) alerts matching these {service,rule} keys.
   */
  silenced?: Set<string>;
  /**
   * Suppress alerts at-or-below this severity (default: 'info' = nothing suppressed).
   */
  minSeverity?: AlertSeverity;
  /**
   * Escalate alerts with severity 'critical' to a different set of channels.
   */
  criticalChannels?: AlertChannel[];
  /**
   * Default channels for non-critical alerts.
   */
  channels: AlertChannel[];
  logger: { info: Function; warn: Function; error: Function; debug?: Function };
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { info: 0, warning: 1, critical: 2 };

export class AlertManager {
  private dedup: AlertDedup;
  private active = new Map<string, Alert>();
  private resolvedHistory: Alert[] = [];
  private opts: Required<Omit<AlertManagerOptions, 'criticalChannels' | 'silenced' | 'logger'>> & {
    silenced: Set<string>;
    criticalChannels: AlertChannel[];
    channels: AlertChannel[];
    logger: AlertManagerOptions['logger'];
  };

  constructor(opts: AlertManagerOptions) {
    this.opts = {
      notifyIntervalMs: opts.notifyIntervalMs ?? 5 * 60 * 1000,
      resolvedRetentionMs: opts.resolvedRetentionMs ?? 60 * 60 * 1000,
      silenced: opts.silenced ?? new Set(),
      minSeverity: opts.minSeverity ?? 'info',
      criticalChannels: opts.criticalChannels ?? [],
      channels: opts.channels,
      logger: opts.logger,
    };
    this.dedup = new AlertDedup(this.opts.notifyIntervalMs);
  }

  /**
   * Silence a (service, rule) combination.
   */
  silence(service: string, rule: string): void {
    this.opts.silenced.add(`${service}::${rule}`);
  }

  unsilence(service: string, rule: string): void {
    this.opts.silenced.delete(`${service}::${rule}`);
  }

  listSilenced(): string[] {
    return [...this.opts.silenced];
  }

  /**
   * Submit a rule result. Returns the resulting Alert (or null if suppressed).
   */
  async submit(rule: RuleDefinition, result: RuleResult): Promise<Alert | null> {
    if (SEVERITY_RANK[rule.severity] < SEVERITY_RANK[this.opts.minSeverity]) {
      return null;
    }
    const key = `${result.labels?.service ?? ''}::${rule.id}`;
    if (this.opts.silenced.has(key)) {
      return null;
    }
    const id = randomUUID();
    const alert: Alert = {
      id,
      rule: rule.id,
      service: result.labels?.service ?? 'unknown',
      severity: rule.severity,
      message: result.message,
      value: result.value,
      threshold: result.threshold,
      startedAt: Date.now(),
      labels: { ...(result.labels ?? {}), rule_name: rule.name },
      context: result.context,
    };

    const observe = this.dedup.observe(alert);
    if (observe === 'fire' || observe === 're-notify') {
      this.active.set(this.dedup.get(alert)!.fingerprint, alert);
      activeAlerts.set({ service: alert.service, rule: alert.rule, severity: alert.severity }, 1);
      alertsFired.inc({ service: alert.service, rule: alert.rule, severity: alert.severity, channel: 'all' });
      const channels = this.channelsFor(alert);
      await this.notify(channels, alert, observe);
    } else if (observe === 'repeat') {
      // still firing, just bump the count
      const existing = this.active.get(this.dedup.get(alert)!.fingerprint);
      if (existing) {
        existing.value = alert.value;
        existing.context = alert.context;
      }
    }
    return alert;
  }

  /**
   * Mark an alert as resolved. Returns true if a transition happened.
   */
  async resolve(rule: string, service: string): Promise<boolean> {
    const key = `${service}::${rule}`;
    const alert = this.active.get(key);
    if (!alert) return false;
    alert.resolvedAt = Date.now();
    this.active.delete(key);
    this.dedup.resolve(alert);
    activeAlerts.set({ service, rule, severity: alert.severity }, 0);
    alertsResolved.inc({ service, rule, severity: alert.severity });
    const channels = this.channelsFor({ ...alert, resolvedAt: Date.now() });
    await this.notifyResolution(channels, alert);
    this.resolvedHistory.unshift({ ...alert, resolvedAt: Date.now() });
    const cutoff = Date.now() - this.opts.resolvedRetentionMs;
    this.resolvedHistory = this.resolvedHistory.filter((a) => (a.resolvedAt ?? 0) >= cutoff);
    return true;
  }

  private channelsFor(alert: Alert | Pick<Alert, 'severity'>): AlertChannel[] {
    if (alert.severity === 'critical' && this.opts.criticalChannels.length > 0) {
      return [...this.opts.criticalChannels, ...this.opts.channels];
    }
    return this.opts.channels;
  }

  private async notify(channels: AlertChannel[], alert: Alert, observe: 'fire' | 're-notify'): Promise<void> {
    const sends = channels.map(async (ch) => {
      try {
        await ch.send(alert);
        alertsFired.inc({
          service: alert.service,
          rule: alert.rule,
          severity: alert.severity,
          channel: ch.name,
        });
      } catch (err) {
        this.opts.logger.error(
          { err: (err as Error).message, channel: ch.name, alertId: alert.id },
          'alert_channel_failed',
        );
      }
    });
    await Promise.all(sends);
    void observe;
  }

  private async notifyResolution(channels: AlertChannel[], alert: Alert): Promise<void> {
    const sends = channels.map(async (ch) => {
      try {
        await ch.send(alert);
      } catch (err) {
        this.opts.logger.error(
          { err: (err as Error).message, channel: ch.name, alertId: alert.id },
          'alert_channel_failed_on_resolve',
        );
      }
    });
    await Promise.all(sends);
  }

  /**
   * Acknowledge an active alert.
   */
  acknowledge(rule: string, service: string, by: string): Alert | undefined {
    const a = this.active.get(`${service}::${rule}`);
    if (!a) return undefined;
    a.acknowledgedAt = Date.now();
    a.acknowledgedBy = by;
    return a;
  }

  listActive(): Alert[] {
    return [...this.active.values()];
  }

  listResolved(limit = 100): Alert[] {
    return this.resolvedHistory.slice(0, limit);
  }
}
