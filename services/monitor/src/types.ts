export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  rule: string;
  service: string;
  severity: AlertSeverity;
  message: string;
  value: number;
  threshold: number;
  startedAt: number;
  resolvedAt?: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  /**
   * Annotation data attached to the alert, used by dedup / routing.
   */
  labels: Record<string, string>;
  context?: Record<string, unknown>;
}

export interface AlertChannel {
  name: string;
  send(alert: Alert): Promise<void>;
}

export interface ServiceTarget {
  name: string;
  url: string;
}

export interface RuleDefinition {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  /**
   * Evaluate the rule. Returns the metric value (and `true` if threshold breached)
   * or `null` to skip.
   */
  evaluate(ctx: RuleContext): Promise<RuleResult | null>;
}

export interface RuleContext {
  services: ServiceTarget[];
  serviceHealth: Map<string, ServiceHealthSnapshot>;
  metrics: Map<string, ScapedMetric[]>;
  dbStats: DbStats;
  redisStats: RedisStats;
  logErrors: LogErrorCount;
  history: AlertHistory;
}

export interface RuleResult {
  value: number;
  threshold: number;
  message: string;
  labels?: Record<string, string>;
  context?: Record<string, unknown>;
}

export interface ServiceHealthSnapshot {
  service: string;
  up: boolean;
  latencyMs: number;
  lastError?: string;
  checkedAt: number;
  statusCode?: number;
}

export interface ScapedMetric {
  service: string;
  name: string;
  value: number;
  labels: Record<string, string>;
  scrapedAt: number;
}

export interface DbStats {
  connected: boolean;
  connectionCount: number;
  maxConnections: number;
  slowQueries: number;
  databaseSizeMb: number;
  tableSizes: Array<{ table: string; sizeMb: number }>;
  error?: string;
}

export interface RedisStats {
  connected: boolean;
  usedMemoryMb: number;
  maxMemoryMb: number;
  connectedClients: number;
  slowCommands: number;
  error?: string;
}

export interface LogErrorCount {
  total: number;
  byService: Map<string, number>;
  byKind: Map<string, number>;
  lastErrorAt?: number;
}

export interface AlertHistory {
  /**
   * Last fired value per (service, rule). Used by anomaly detection.
   */
  lastValue(key: string): number | undefined;
  recordValue(key: string, value: number, t?: number): void;
  recentValues(key: string, windowMs: number): Array<{ value: number; t: number }>;
  zScore(key: string, windowMs: number): number;
  mean(key: string, windowMs: number): number;
}
