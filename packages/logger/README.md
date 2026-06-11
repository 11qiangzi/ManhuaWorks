# @manhuaworks/logger

Structured logging (pino) + OpenTelemetry tracer + prom-client metrics +
Express / ws middleware. Shared by every backend service in the ManhuaWorks
platform.

## Highlights

- **Structured JSON logs** via `pino`, with optional `pino-pretty` for dev
- **Trace context** propagated through every log line (`traceId`, `spanId`),
  via `@opentelemetry/api` and an internal `AsyncLocalStorage` for `requestId`
  + `userId`
- **Prometheus metrics** out of the box: `http_requests_total`,
  `http_request_errors_total`, `http_request_duration_seconds`,
  `http_active_connections`, `ws_connections`, `ws_messages_total`,
  `errors_total` (per-service prefix `manhuaworks_<service>_*`)
- **Drop-in Express middleware** that auto-injects `X-Request-Id`, opens a
  span, logs every request, and feeds metrics
- **Drop-in ws middleware** for `WebSocketServer` (connection/message/close/error)
- **Express error handler** that captures unhandled exceptions and surfaces
  `requestId` + `traceId` to the client

## Quick start

```ts
import express from 'express';
import {
  createLogger,
  httpLoggerMiddleware,
  errorHandlerMiddleware,
  metrics,
  getBuiltinMetrics,
} from '@manhuaworks/logger';

const service = 'user-service';
const logger = createLogger(service);
const app = express();

// Expose Prometheus metrics
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', getBuiltinMetrics(`manhuaworks_user_service_`).registry.contentType);
  res.end(await getBuiltinMetrics(`manhuaworks_user_service_`).registry.metrics());
});

app.use(httpLoggerMiddleware({ service, logger }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// ... your routes ...

app.use(errorHandlerMiddleware({ service, logger }));

app.listen(3000);
```

## WebSocket

```ts
import { WebSocketServer } from 'ws';
import { wsLoggerAttach } from '@manhuaworks/logger';

const wss = new WebSocketServer({ server: httpServer });
wsLoggerAttach(wss, { service: 'collab-service', logger });
```

## Trace context propagation

The middleware extracts an incoming `traceparent` / `X-Request-Id` and writes
`X-Request-Id` on the response. Downstream services that also use this
package continue the trace automatically.
