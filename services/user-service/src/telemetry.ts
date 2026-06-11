/**
 * user-service — OpenTelemetry bootstrap
 *
 * ManhuaWorks L2 task 14：链路追踪
 *
 * 重要：此文件必须 **第一个** 被 import（在 ./index.ts 顶部）。
 *   import './telemetry'  // ← 必须在所有业务 import 之前
 *
 * 行为：
 *  - 启动 NodeSDK + OTLP HTTP Exporter（默认 http://localhost:4318）
 *  - 注册 auto instrumentations：HTTP / Express / Postgres / Redis / WS
 *  - 设置 service.name = 'user-service'
 *  - 装 W3C TraceContext + Baggage propagator（让 traceparent 自动透传）
 *
 * 环境变量：
 *   OTEL_EXPORTER_OTLP_ENDPOINT    默认 http://localhost:4318
 *   OTEL_SERVICE_NAME              默认 'user-service'
 *   OTEL_TRACES_ENABLED            默认 true
 *   NODE_ENV                       development | production | test
 */
import { initTelemetry } from '@manhuaworks/logger';

const service = process.env.OTEL_SERVICE_NAME ?? 'user-service';
const version = process.env.npm_package_version ?? '0.1.0';

void initTelemetry({
  service,
  serviceVersion: version,
  environment: process.env.NODE_ENV ?? 'development',
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
});
