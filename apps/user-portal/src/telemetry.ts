/**
 * @manhuaworks/user-portal — 浏览器端 OpenTelemetry RUM
 *
 * 千机工坊 L2 task 14
 */
import { diag, DiagConsoleLogger, DiagLogLevel, trace, SpanStatusCode } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';

if (import.meta.env?.DEV) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
}

interface TelemetryConfig {
  service: string;
  version: string;
  environment: string;
  otlpEndpoint: string;
  enabled: boolean;
}

function loadConfig(): TelemetryConfig {
  const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
  return {
    service: env['VITE_OTEL_SERVICE_NAME'] ?? 'user-portal',
    version: env['VITE_APP_VERSION'] ?? '0.1.0',
    environment: env['VITE_ENV'] ?? env['MODE'] ?? 'development',
    otlpEndpoint:
      env['VITE_OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318/v1/traces',
    enabled: env['VITE_OTEL_TRACES_ENABLED'] !== 'false',
  };
}

const cfg = loadConfig();
let provider: WebTracerProvider | null = null;

export async function initBrowserTelemetry(): Promise<void> {
  if (provider) return;
  if (!cfg.enabled) {
    trace.setGlobalPropagator(new W3CTraceContextPropagator());
    return;
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: cfg.service,
    [ATTR_SERVICE_VERSION]: cfg.version,
    [ATTR_DEPLOYMENT_ENVIRONMENT]: cfg.environment,
  });

  provider = new WebTracerProvider({ resource });
  const exporter = cfg.environment === 'production'
    ? new BatchSpanProcessor(new OTLPTraceExporter({ url: cfg.otlpEndpoint }))
    : new SimpleSpanProcessor(
        cfg.environment === 'development'
          ? new ConsoleSpanExporter()
          : new OTLPTraceExporter({ url: cfg.otlpEndpoint }),
      );
  provider.addSpanProcessor(exporter);

  provider.register({
    propagator: new W3CTraceContextPropagator(),
    instrumentations: [
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [/.*/],
        clearTimingResources: true,
      }),
      new XMLHttpRequestInstrumentation(),
      new DocumentLoadInstrumentation(),
    ],
  });

  window.addEventListener('beforeunload', () => {
    void provider?.shutdown().catch(() => undefined);
  });
}

export function markRouteSpan(to: string, from: string | null = null): void {
  const tracer = trace.getTracer('@manhuaworks/user-portal');
  const span = tracer.startSpan('route.change', {
    attributes: { 'route.to': to, 'route.from': from ?? '(initial)' },
  });
  Promise.resolve().then(() => {
    try {
      span.setStatus({ code: SpanStatusCode.OK });
    } finally {
      span.end();
    }
  });
}

void initBrowserTelemetry();
