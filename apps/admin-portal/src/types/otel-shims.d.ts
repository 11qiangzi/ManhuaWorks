/**
 * OpenTelemetry 类型垫片
 * ─────────────────────────────────────────
 * 当 OTel 依赖尚未安装时，为 telemetry.ts 提供最小类型声明，
 * 避免 vue-tsc 编译失败。安装实际包后可安全删除此文件。
 */

declare module '@opentelemetry/core' {
  export const W3CTraceContextPropagator: any
  export function getGlobalThis(): any
}

declare module '@opentelemetry/resources' {
  export const Resource: any
  export function resourceFromAttributes(attrs: Record<string, unknown>): any
  export type ResourceAttributes = Record<string, unknown>
}

declare module '@opentelemetry/semantic-conventions' {
  export const ATTR_DEPLOYMENT_ENVIRONMENT: string
  export const ATTR_SERVICE_NAME: string
  export const ATTR_SERVICE_VERSION: string
  export const SEMRESATTRS_DEPLOYMENT_ENVIRONMENT: string
}

declare module '@opentelemetry/sdk-trace-web' {
  export class WebTracerProvider {
    constructor(config?: any)
    addSpanProcessor(p: any): void
    register(config?: any): void
    shutdown(): Promise<void>
  }
}

declare module '@opentelemetry/sdk-trace-base' {
  export class BatchSpanProcessor {
    constructor(exporter: any, config?: any)
  }
  export class SimpleSpanProcessor {
    constructor(exporter: any)
  }
  export class ConsoleSpanExporter {
    constructor()
  }
}

declare module '@opentelemetry/exporter-trace-otlp-http' {
  export class OTLPTraceExporter {
    constructor(config?: any)
  }
}

declare module '@opentelemetry/instrumentation-fetch' {
  export class FetchInstrumentation {
    constructor(config?: any)
  }
}

declare module '@opentelemetry/instrumentation-xml-http-request' {
  export class XMLHttpRequestInstrumentation {
    constructor(config?: any)
  }
}

declare module '@opentelemetry/instrumentation-document-load' {
  export class DocumentLoadInstrumentation {
    constructor(config?: any)
  }
}
