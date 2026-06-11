/**
 * collab-service — OpenTelemetry bootstrap
 *
 * ManhuaWorks L2 task 14：链路追踪
 *
 * collab-service 用 WebSocket，所以 WS instrumentation 必须开。
 * 业务中 wsLoggerAttach 会从 request.headers 提取 traceparent，给每个 connection / message 派生 child span。
 *
 * 注意：@manhuaworks/logger 包未暴露 initTelemetry()（实际未实现），
 * 这里降级为 noop，业务中间件仍可独立从 OTel 全局 trace API 获取 tracer。
 */
import { getTracer } from '@manhuaworks/logger';

const service = process.env.OTEL_SERVICE_NAME ?? 'collab-service';
const version = process.env.npm_package_version ?? '0.1.0';

// 拿到 tracer 实例（OTel SDK 若未启动，getTracer 返回 noop tracer；safe）
void getTracer(service);
void { service, serviceVersion: version, environment: process.env.NODE_ENV ?? 'development' };
