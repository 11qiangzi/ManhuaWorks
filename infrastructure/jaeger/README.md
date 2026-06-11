# ManhuaWorks Jaeger

## 启动

```bash
cd infrastructure/jaeger
docker compose up -d
```

## 端口

| 端口 | 用途 |
|------|------|
| 16686 | Jaeger UI（浏览器打开） |
| 4317 | OTLP gRPC（备用） |
| 4318 | **OTLP HTTP**（我们用这个） |
| 14268 | Thrift collector（旧） |
| 14250 | gRPC 模型（新） |

## 看 trace

1. 浏览器打开 http://localhost:16686
2. Service 下拉选 `api-gateway` / `user-service` / `project-service` / `billing-service` / `collab-service` / `monitor`
3. 点 Find Traces

## 环境变量模板

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_SERVICE_NAME=api-gateway
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=development
```

容器内：endpoint 用 `http://jaeger:4318`
本机进程：endpoint 用 `http://localhost:4318`

## 排错

- 看不到 trace：检查容器是否能 join mhw-net
  ```bash
  docker network inspect mhw-net
  ```
- 端口被占：改 ports 映射
- 启动慢：Jaeger all-in-one 启动一般 <10s
