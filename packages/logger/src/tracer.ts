/**
 * @manhuaworks/logger — tracer.ts
 *
 * 职责：
 *  1. 暴露 `getTracer()` 给业务代码（withSpan / currentTraceContext 等）
 *  2. 暴露 `initTelemetry(opts)` 给服务启动期一次性初始化：
 *     - 构造 OTLP HTTP Exporter（默认指向 http://localhost:4318/v1/traces）
 *     - 注册 W3C TraceContext + Baggage Propagator（强制透传 traceparent）
 *     - 注册常用 instrumentations（HTTP / Express / Postgres / Redis / WS）
 *  3. 暴露 `injectTraceparent(headers)` / `extractTraceparent(headers)` 工具，
 *     让 fetch wrapper / 出口 HTTP 强制带 traceparent 头
 *
 * 环境变量：
 *   OTEL_EXPORTER_OTLP_ENDPOINT  默认 http://localhost:4318
 *                                 （SDK 会自动追加 /v1/traces）
 *   OTEL_SERVICE_NAME            默认 opts.service
 *   OTEL_TRACES_ENABLED          默认 true；false 时 initTelemetry 走 noop
 *   OTEL_PROPAGATORS             默认 'tracecontext,baggage'（W3C）
 *
 * 设计原则：
 *  - 调用 initTelemetry 之前所有 getTracer() 都是 noop（用 @opentelemetry/api 默认
 *    noop tracer），不会因为"忘了初始化"就 crash
 *  - 第二次调用 initTelemetry 直接返回（幂等）
 *  - service.name 来自入参，确保 4 业务后端 / api-gateway / monitor 名字区分
 */

import {
  trace,
  Tracer,
  Span,
  SpanOptions,
  context,
  SpanStatusCode,
  Context,
  propagation,
  defaultTextMapSetter,
  defaultTextMapGetter,
  TextMapPropagator,
} from '@opentelemetry/api';

// 类型只在 dev 阶段用得到；runtime 都是 dynamic require，不强依赖
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpanExporter = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReadableSpan = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Instrumentation = any;

const TRACER_NAME = '@manhuaworks/logger';
const DEFAULT_OTLP_ENDPOINT = 'http://localhost:4318';

let initialized = false;
let initTracer: Tracer | null = null;
let sdkStop: (() => Promise<void>) | null = null;

/* ------------------------------------------------------------------ */
/*                       Public: getTracer                             */
/* ------------------------------------------------------------------ */

/**
 * Get (or initialize) the package-level tracer. Returns the global tracer
 * registered via @opentelemetry/api's `trace`; if initTelemetry has not been
 * called, it falls back to the no-op tracer provided by the API package.
 */
export function getTracer(name: string = TRACER_NAME): Tracer {
  if (initialized && initTracer) return initTracer;
  initTracer = trace.getTracer(name);
  initialized = true;
  return initTracer;
}

/* ------------------------------------------------------------------ */
/*                  Public: initTelemetry (SDK bootstrap)              */
/* ------------------------------------------------------------------ */

export interface InitTelemetryOptions {
  /** 服务名，会作为 OTel resource attribute `service.name` */
  service: string;
  /** 服务版本（可选） */
  serviceVersion?: string;
  /** 部署环境，默认 'development' */
  environment?: string;
  /** OTLP HTTP endpoint（默认读 env OTEL_EXPORTER_OTLP_ENDPOINT 或 http://localhost:4318） */
  otlpEndpoint?: string;
  /** 想要注册的 instrumentations；不传则用 defaultInstrumentations() */
  instrumentations?: Instrumentation[];
  /** 强制启用/禁用（默认读 env OTEL_TRACES_ENABLED） */
  enabled?: boolean;
}

/**
 * 构造一组默认的 instrumentations：HTTP / Express / Postgres / Redis / WS。
 * 用 dynamic import 避免在 logger 包里写硬依赖（consuming service 拉了
 * auto-instrumentations-node 才生效）。
 */
async function defaultInstrumentations(): Promise<Instrumentation[]> {
  try {
    // dynamic require — 在 CJS 下走 createRequire
    const req = createRequireFn();
    const mod = req('@opentelemetry/auto-instrumentations-node') as
      | { getNodeAutoInstrumentations: (cfg: Record<string, unknown>) => Instrumentation[] }
      | undefined;
    if (!mod) return [];
    return mod.getNodeAutoInstrumentations({
      // 关闭 fs 噪声（高 QPS 时 span 太多）
      '@opentelemetry/instrumentation-fs': { enabled: false },
      // DNS 噪声
      '@opentelemetry/instrumentation-dns': { enabled: false },
      // Net 层
      '@opentelemetry/instrumentation-net': { enabled: false },
      '@opentelemetry/instrumentation-express': { enabled: true },
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },
      '@opentelemetry/instrumentation-ioredis': { enabled: true },
      '@opentelemetry/instrumentation-redis-4': { enabled: true },
      '@opentelemetry/instrumentation-ws': { enabled: true },
    });
  } catch {
    return [];
  }
}

function createRequireFn(): (id: string) => unknown {
  // Node CJS —— 直接用 require
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeReq = eval('require') as NodeRequire;
  return (id: string) => nodeReq(id);
}

/**
 * 启动 OTel SDK：构造 NodeSDK（带 OTLP HTTP exporter + W3C propagator + resource），
 * 注册 instrumentations。多次调用幂等。
 *
 * 重要：必须在 import 应用代码之前调用，否则 instrumentations 抓不到 module load。
 */
export async function initTelemetry(opts: InitTelemetryOptions): Promise<void> {
  if (sdkStop) return; // 幂等

  const enabled = opts.enabled ?? parseBoolEnv('OTEL_TRACES_ENABLED', true);
  if (!enabled) {
    // M3 fix: NOT setting global propagator when disabled (avoids recursion bug
    // when buildW3CPropagator() falls back to `propagation` itself)
    return;
  }

  const endpoint = stripV1Traces(
    opts.otlpEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? DEFAULT_OTLP_ENDPOINT,
  );

  // 动态加载 SDK 依赖（避免硬依赖）
  const req = createRequireFn();
  type NodeSdkCtor = new (cfg: Record<string, unknown>) => {
    start(): void;
    shutdown(): Promise<void>;
  };
  type OtlpHttpExporterCtor = new (cfg: Record<string, unknown>) => SpanExporter;

  const sdkMod = req('@opentelemetry/sdk-node') as { NodeSDK?: NodeSdkCtor } | undefined;
  const exporterMod = req('@opentelemetry/exporter-trace-otlp-http') as
    | { OTLPTraceExporter?: OtlpHttpExporterCtor }
    | undefined;
  const resourcesMod = req('@opentelemetry/resources') as
    | { Resource?: { default?: unknown } }
    | undefined;
  const semconv = req('@opentelemetry/semantic-conventions') as Record<string, string>;

  if (!sdkMod?.NodeSDK || !exporterMod?.OTLPTraceExporter) {
    // 没装 SDK，no-op
    return;
  }

  // Resource — semantic-conventions 字段名跨版本不一致，做 try/catch
  let resource: unknown = undefined;
  try {
    const ResourceCtor = (resourcesMod?.Resource as { default?: unknown } | undefined)?.default
      ?? resourcesMod?.Resource;
    if (ResourceCtor) {
      resource = new (ResourceCtor as new (cfg: Record<string, unknown>) => unknown)({
        [semconv.SEMRESATTRS_SERVICE_NAME ?? 'service.name']: opts.service,
        [semconv.SEMRESATTRS_SERVICE_VERSION ?? 'service.version']:
          opts.serviceVersion ?? process.env.npm_package_version ?? '0.0.0',
        [semconv.SEMRESATTRS_DEPLOYMENT_ENVIRONMENT ?? 'deployment.environment']:
          opts.environment ?? process.env.NODE_ENV ?? 'development',
      });
    }
  } catch {
    resource = undefined;
  }

  const exporter = new exporterMod.OTLPTraceExporter({ url: `${endpoint}/v1/traces` });
  const instrumentations = opts.instrumentations ?? (await defaultInstrumentations());

  const sdk = new sdkMod.NodeSDK({
    resource: resource as never,
    traceExporter: exporter,
    instrumentations,
    textMapPropagator: buildW3CPropagator(),
  });

  try {
    sdk.start();
  } catch (err) {
    // 不让 telemetry 把整个进程搞崩
    // eslint-disable-next-line no-console
    console.warn('[telemetry] sdk.start failed:', (err as Error).message);
    return;
  }

  sdkStop = async () => {
    try {
      await sdk.shutdown();
    } catch {
      /* noop */
    }
  };

  // 进程退出时 flush
  const flush = (): void => {
    void sdkStop?.();
  };
  process.once('SIGTERM', flush);
  process.once('SIGINT', flush);
}

/**
 * 主动 flush & shutdown。优雅关闭时调用。
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdkStop) {
    await sdkStop();
    sdkStop = null;
  }
}

/* ------------------------------------------------------------------ */
/*            Public: W3C traceparent inject / extract                */
/* ------------------------------------------------------------------ */

/**
 * 强制注入 W3C traceparent 头到出口 HTTP 请求。
 * 用法：fetch(url, { headers: injectTraceparent({ 'X-Foo': '1' }) })
 *
 * 注意：使用 OTel propagation API，所以 context 内有 active span 时会自动
 * 派生 child span 的 traceparent；无 active span 时也会生成一个 traceparent
 * （propagator 会回退到 noop / 空）。
 */
export function injectTraceparent<T extends Record<string, string>>(
  headers: T = {} as T,
): T & Record<string, string> {
  const carrier: Record<string, string> = { ...headers };
  propagation.inject(context.active(), carrier, defaultTextMapSetter);
  return carrier as T & Record<string, string>;
}

/**
 * 从入口 HTTP 头里读 traceparent，派生一个 OTel Context。
 * 用法：const ctx = extractTraceparent(req.headers); context.with(ctx, () => ...)
 */
export function extractTraceparent(headers: Record<string, string | string[] | undefined>): Context {
  const carrier: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === 'string') carrier[k] = v;
    else if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') carrier[k] = v[0];
  }
  return propagation.extract(context.active(), carrier, defaultTextMapGetter);
}

/**
 * 解析 traceparent 头拿到 traceId（32 字符 hex），失败返回 undefined。
 * 业务侧要往 response header 写 X-Trace-Id 时用这个。
 */
export function getCurrentTraceId(): string | undefined {
  const span = trace.getSpan(context.active());
  const sc = span?.spanContext();
  if (!sc || !sc.traceId) return undefined;
  return sc.traceId;
}

/* ------------------------------------------------------------------ */
/*             Public: TraceContext 数据结构 + helpers                 */
/* ------------------------------------------------------------------ */

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export function currentTraceContext(): TraceContext | undefined {
  const span = trace.getSpan(context.active());
  if (!span) return undefined;
  const sc = span.spanContext();
  if (!sc || !sc.traceId) return undefined;
  const parent = (span as unknown as { parentSpanContext?: { spanId?: string } }).parentSpanContext;
  return {
    traceId: sc.traceId,
    spanId: sc.spanId,
    parentSpanId: parent?.spanId,
  };
}

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
  opts: SpanOptions = {},
  parentCtx?: Context,
): Promise<T> {
  const tracer = getTracer();
  const baseCtx = parentCtx ?? context.active();
  // 用 context.with 把 baseCtx 设为 active，startActiveSpan 内部再把 span 设上去
  return context.with(baseCtx, () =>
    tracer.startActiveSpan(name, opts, async (span) => {
      try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      const e = err as Error;
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e?.message ?? 'error' });
      throw err;
    } finally {
      span.end();
    }
    }),
  );
}

export function withSpanSync<T>(
  name: string,
  fn: (span: Span) => T,
  opts: SpanOptions = {},
  parentCtx?: Context,
): T {
  const tracer = getTracer();
  const baseCtx = parentCtx ?? context.active();
  const span = tracer.startSpan(name, opts, baseCtx);
  try {
    const result = context.with(trace.setSpan(baseCtx, span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    const e = err as Error;
    span.recordException(e);
    span.setStatus({ code: SpanStatusCode.ERROR, message: e?.message ?? 'error' });
    throw err;
  } finally {
    span.end();
  }
}

export function traceContextFromHeaders(headers: Record<string, string | string[] | undefined>): Context {
  return extractTraceparent(headers);
}

/* ------------------------------------------------------------------ */
/*                          Internals                                  */
/* ------------------------------------------------------------------ */

/** W3C TraceContext + Baggage propagator（标准 traceparent + tracestate + baggage） */
function buildW3CPropagator(): TextMapPropagator {
  try {
    const req = createRequireFn();
    const mod = req('@opentelemetry/core') as
      | {
          W3CTraceContextPropagator?: new () => TextMapPropagator;
          W3CBaggagePropagator?: new () => TextMapPropagator;
          CompositePropagator?: new (ps: TextMapPropagator[]) => TextMapPropagator;
        }
      | undefined;
    if (!mod?.W3CTraceContextPropagator) {
      return {
      extract: (c, carrier, getter) => c,
      inject: (c, carrier, setter) => c,
      fields: () => [],
    };
    }
    const propagators: TextMapPropagator[] = [new mod.W3CTraceContextPropagator()];
    if (mod.W3CBaggagePropagator) propagators.push(new mod.W3CBaggagePropagator());
    if (mod.CompositePropagator) return new mod.CompositePropagator(propagators);
    return new mod.W3CTraceContextPropagator();
  } catch {
    return {
      extract: (c, carrier, getter) => c,
      inject: (c, carrier, setter) => c,
      fields: () => [],
    };
  }
}

function parseBoolEnv(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return !(v === '0' || v.toLowerCase() === 'false');
}

/** 去掉 endpoint 末尾的 /v1/traces（SDK 会自己拼） */
function stripV1Traces(ep: string): string {
  return ep.replace(/\/v1\/traces\/?$/, '').replace(/\/+$/, '');
}

/** 标记 SDK 是否已初始化（test / debug 用） */
export function isTelemetryInitialized(): boolean {
  return sdkStop !== null;
}

export type { Span, Tracer, SpanOptions, ReadableSpan };
