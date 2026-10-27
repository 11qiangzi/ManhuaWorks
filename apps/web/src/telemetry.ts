/**
 * @manhuaworks/web — 浏览器端 OpenTelemetry RUM
 *
 * 千机工坊 L2 task 14
 *
 * 目标：
 *  - 浏览器侧自动上报 fetch / XHR / 页面加载 / 路由切换
 *  - traceId 与 api-gateway 透传过来的 X-Trace-Id 一致（同一 trace）
 *
 * 使用方式（在 main.ts 顶部）：
 *   import './telemetry'   // MUST be first
 *
 * 注意：
 *  - 浏览器没有用 @opentelemetry/sdk-node（太大），用 sdk-web + OTLP HTTP exporter
 *  - 浏览器通过 api-client http.ts 自动给每个请求加 traceparent 头（用
 *    api-client 的 X-Trace-Id 自定义 header 与 gateway 的 traceparent 互通）
 *  - 如果 jaeger 不可达，OTLP exporter 内部会缓冲丢弃，不会阻塞 UI
 *
 * 重要：本文件 *必须* 在 Vue/Vue Router/Pinia 之前 import。
 */

import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  trace,
  context,
  SpanStatusCode,
} from '@opentelemetry/api';
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

// 只在开发期打印，避免生产刷屏
if (import.meta.env?.DEV) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
}

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

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
    service: env['VITE_OTEL_SERVICE_NAME'] ?? 'web',
    version: env['VITE_APP_VERSION'] ?? '0.1.0',
    environment: env['VITE_ENV'] ?? env['MODE'] ?? 'development',
    otlpEndpoint:
      env['VITE_OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318/v1/traces',
    enabled: env['VITE_OTEL_TRACES_ENABLED'] !== 'false',
  };
}

const cfg = loadConfig();
let provider: WebTracerProvider | null = null;

/**
 * 启动浏览器端 OTel。
 * 多次调用幂等。
 */
export async function initBrowserTelemetry(): Promise<void> {
  if (provider) return;
  if (!cfg.enabled) {
    // 仍然注册 propagator（让 fetch 自动带 traceparent）
    const dummyResource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: cfg.service,
    });
    provider = new WebTracerProvider({ resource: dummyResource });
    provider.register({
      propagator: new W3CTraceContextPropagator(),
    });
    return;
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: cfg.service,
    [ATTR_SERVICE_VERSION]: cfg.version,
    [ATTR_DEPLOYMENT_ENVIRONMENT]: cfg.environment,
  });

  provider = new WebTracerProvider({ resource });

  // 生产用 batch（性能），开发用 console
  const exporter = cfg.environment === 'production'
    ? new BatchSpanProcessor(new OTLPTraceExporter({ url: cfg.otlpEndpoint }))
    : new SimpleSpanProcessor(
        cfg.environment === 'development'
          ? new ConsoleSpanExporter()
          : new OTLPTraceExporter({ url: cfg.otlpEndpoint }),
      );

  provider.addSpanProcessor(exporter);

  // 自动 instrumentation
  provider.register({
    propagator: new W3CTraceContextPropagator(),
    instrumentations: [
      new FetchInstrumentation({
        // 给 gateway 的 fetch 加 traceparent 头
        propagateTraceHeaderCorsUrls: [/.*/],
        clearTimingResources: true,
      }),
      new XMLHttpRequestInstrumentation(),
      new DocumentLoadInstrumentation(),
      // route 切换的 span 由我们手动在 router/index.ts 加，
      // 这里不开 user-interaction（点一下就一个 span 太吵）
    ],
  });

  // 卸载时 flush
  window.addEventListener('beforeunload', () => {
    void provider?.shutdown().catch(() => undefined);
  });
}

/**
 * 给 route 切换加 span。给 Vue Router beforeEach 用：
 *   router.beforeEach((to, from) => markRouteSpan(to.fullPath, from.fullPath))
 */
export function markRouteSpan(to: string, from: string | null = null): void {
  const tracer = trace.getTracer('@manhuaworks/web');
  const span = tracer.startSpan('route.change', {
    attributes: {
      'route.to': to,
      'route.from': from ?? '(initial)',
    },
  });
  // 异步在 next tick end
  Promise.resolve().then(() => {
    try {
      span.setStatus({ code: SpanStatusCode.OK });
    } finally {
      span.end();
    }
  });
}

/**
 * 取当前 active span 的 traceId。
 * 前端 console 调试用。
 */
export function getCurrentBrowserTraceId(): string | undefined {
  const span = trace.getSpan(context.active());
  const sc = span?.spanContext();
  return sc?.traceId || undefined;
}

// 自动启动
void initBrowserTelemetry();
