/**
 * monitor — OpenTelemetry bootstrap
 *
 * ManhuaWorks L2 task 14：链路追踪
 *
 * 重要：此文件必须 **第一个** 被 import（在 ./index.ts 顶部）。
 *
 * monitor 比较特殊：它自己也是一个服务，但同时要抓取其他服务的 metrics。
 * 所以本服务也会发 OTLP，同时 collectors/* 里会主动 withSpan 包住每次抓取，
 * 这样在 Jaeger 里能看「monitor 抓 user-service /metrics」这个调用。
 */
import { initTelemetry } from '@manhuaworks/logger';

const service = process.env.OTEL_SERVICE_NAME ?? 'monitor';
const version = process.env.npm_package_version ?? '0.1.0';

void initTelemetry({
  service,
  serviceVersion: version,
  environment: process.env.NODE_ENV ?? 'development',
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
});
