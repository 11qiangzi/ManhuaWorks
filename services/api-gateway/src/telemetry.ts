/**
 * api-gateway — OpenTelemetry bootstrap
 *
 * ManhuaWorks L2 task 14：链路追踪
 *
 * 重要：此文件必须 **第一个** 被 import（在 ./index.ts 顶部）。
 *
 * api-gateway 是 trace 的「根」 —— 4 前端 → api-gateway → 4 后端 → PG/Redis 全链路。
 *
 * 自动 instrumentations：
 *  - HTTP outbound: 4 后端的 fetch / undici 都会自动 span 化
 *  - ioredis: 限流键的 INCR/EXPIRE 都会自动 span 化
 *  - pg: 网关自己如果直查 DB（目前没有）也覆盖
 *
 * W3C propagator：traceparent 头会从入站请求自动提取，注入到所有出站 fetch。
 * 这就是为什么 `outHeaders()` 在 monitor 那边的 scrape fetch 里也要用 —— 链路才不断。
 */
import { initTelemetry } from '@manhuaworks/logger';

const service = process.env.OTEL_SERVICE_NAME ?? 'api-gateway';
const version = process.env.npm_package_version ?? '0.1.0';

void initTelemetry({
  service,
  serviceVersion: version,
  environment: process.env.NODE_ENV ?? 'development',
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
});
