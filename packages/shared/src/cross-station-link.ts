// 跨站跳转协议 — 千机工坊 v3.0
// 主站(3000) ↔ 客户后台(5180) ↔ 管理后台(5174)

export const STATIONS = {
  main:    { port: 3000, name: '主站' },
  portal:  { port: 5180, name: '客户后台' },
  admin:   { port: 5174, name: '管理后台' },
} as const;

export type StationKey = keyof typeof STATIONS;

/**
 * Build a full URL to another station
 * Example: buildStationUrl('admin', '/monitoring') → 'http://localhost:5174/monitoring'
 */
export function buildStationUrl(station: StationKey, path: string): string {
  const s = STATIONS[station];
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${hostname}:${s.port}${path}`;
}

/**
 * Navigate browser to another station (full page redirect)
 */
export function navigateToStation(station: StationKey, path: string): void {
  if (typeof window !== 'undefined') {
    window.location.href = buildStationUrl(station, path);
  }
}

/**
 * Open another station in a new tab
 */
export function openStation(station: StationKey, path: string): void {
  if (typeof window !== 'undefined') {
    window.open(buildStationUrl(station, path), '_blank');
  }
}
