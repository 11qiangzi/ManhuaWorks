import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { LogErrorCount } from '../types';

const ROOT = process.env.MONITOR_LOG_ROOT ?? path.resolve(process.cwd(), '../../logs');

interface ServiceLogs {
  service: string;
  file: string;
  position: number;
  recent: string[]; // circular buffer
}

/**
 * Tail JSON-per-line log files written by each service.
 * Format: one JSON object per line (pino default).
 *
 * Aggregates total errors, errors per service, errors per `kind` field.
 */
export class LogTailer {
  private tailers: ServiceLogs[] = [];
  private maxLines: number;
  private bufferSize: number;
  private since = new Map<string, number>(); // service -> first error timestamp to count

  constructor(opts: { maxLines?: number; bufferSize?: number } = {}) {
    this.maxLines = opts.maxLines ?? 200;
    this.bufferSize = opts.bufferSize ?? 5000;
  }

  async init(services: string[]): Promise<void> {
    this.tailers = await Promise.all(
      services.map(async (service) => {
        const file = path.join(ROOT, `${service}.log`);
        let position = 0;
        try {
          const stat = await fs.stat(file);
          position = stat.size;
        } catch {
          // file may not exist yet; that's fine
        }
        return { service, file, position, recent: [] };
      }),
    );
  }

  addService(service: string): void {
    if (this.tailers.find((t) => t.service === service)) return;
    this.tailers.push({
      service,
      file: path.join(ROOT, `${service}.log`),
      position: 0,
      recent: [],
    });
  }

  /**
   * Read new lines from all configured log files, return a snapshot of
   * error counts since the last poll.
   */
  async poll(): Promise<LogErrorCount> {
    const byService = new Map<string, number>();
    const byKind = new Map<string, number>();
    let total = 0;
    let lastErrorAt: number | undefined;

    for (const tailer of this.tailers) {
      try {
        const stat = await fs.stat(tailer.file);
        if (stat.size < tailer.position) {
          // file was truncated/rotated
          tailer.position = 0;
        }
        if (stat.size === tailer.position) continue;
        const fh = await fs.open(tailer.file, 'r');
        try {
          const length = stat.size - tailer.position;
          if (length <= 0 || length > 10 * 1024 * 1024) {
            // skip huge jumps
            tailer.position = stat.size;
            continue;
          }
          const buf = Buffer.alloc(length);
          await fh.read(buf, 0, length, tailer.position);
          tailer.position = stat.size;
          const text = buf.toString('utf8');
          const lines = text.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            tailer.recent.push(line);
            if (tailer.recent.length > this.bufferSize) {
              tailer.recent.splice(0, tailer.recent.length - this.bufferSize);
            }
            let parsed: Record<string, unknown> | null = null;
            try {
              parsed = JSON.parse(line) as Record<string, unknown>;
            } catch {
              continue;
            }
            const level = Number(parsed.level ?? 0);
            const time = typeof parsed.time === 'number' ? parsed.time : Date.now();
            if (level >= 50) {
              total++;
              byService.set(tailer.service, (byService.get(tailer.service) ?? 0) + 1);
              const kind = (parsed.err as { name?: string } | undefined)?.name ?? 'Error';
              byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
              if (!lastErrorAt || time > lastErrorAt) lastErrorAt = time;
            }
          }
        } finally {
          await fh.close();
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          // unexpected: surface
          // eslint-disable-next-line no-console
          console.warn(`[logTailer] ${tailer.service}: ${(err as Error).message}`);
        }
      }
    }

    return { total, byService, byKind, lastErrorAt };
  }

  recentFor(service: string, limit = 100): string[] {
    const t = this.tailers.find((x) => x.service === service);
    if (!t) return [];
    return t.recent.slice(-limit);
  }
}

export const sharedLogTailer = new LogTailer();
