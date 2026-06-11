# @manhuaworks/monitor

ManhuaWorks observability service.

- Health probing of every backend (4 业务后端 + api-gateway + monitor)
- Prometheus metrics scraping (`/metrics` from each service) every 15s
- Postgres slow queries, connection pool, table sizes
- Redis memory / clients / SLOWLOG
- 30+ threshold rules + 5+ anomaly rules
- Alert lifecycle: fire → ack → resolve / silence
- Channels: Feishu webhook / Email (SMTP) / generic webhook
- Dedup with re-notify cooldown
- Exposes its own `/metrics` and `/health` for Prometheus / Grafana

## Endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET    | /health | service health summary |
| GET    | /health/deep | db + redis deep check |
| GET    | /metrics | prometheus metrics |
| GET    | /alerts | active alerts |
| GET    | /alerts/resolved?limit=N | recent resolved |
| POST   | /alerts/acknowledge | { service, rule, by } |
| POST   | /alerts/resolve | { service, rule } |
| POST   | /alerts/silence | { service, rule } |
| DELETE | /alerts/silence | { service, rule } |
| GET    | /alerts/silenced | list silenced |
| GET    | /dashboard | services + metrics snapshot |

## Run

```bash
cp .env .env.local
pnpm install
pnpm dev          # tsx watch
pnpm build && pnpm start
```

## Tests

```bash
pnpm test         # vitest run
```

## Docker

```bash
docker compose -f infrastructure/docker-compose.monitor.yml up -d
```
