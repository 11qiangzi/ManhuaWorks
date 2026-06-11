/**
 * project-service — OpenTelemetry bootstrap
 *
 * ManhuaWorks L2 task 14：链路追踪
 *
 * 重要：此文件必须 **第一个** 被 import（在 ./index.ts 顶部）。
 */
import { initTelemetry } from '@manhuaworks/logger';

const service = process.env.OTEL_SERVICE_NAME ?? 'project-service';
const version = process.env.npm_package_version ?? '0.1.0';

void initTelemetry({
  service,
  serviceVersion: version,
  environment: process.env.NODE_ENV ?? 'development',
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
});
