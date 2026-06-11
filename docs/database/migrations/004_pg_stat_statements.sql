-- 004_pg_stat_statements.sql
-- 派单 25: 启用 pg_stat_statements 查询性能监控
-- 2026-06-10 谢擎
--
-- 前置条件: postgresql.conf 需加 shared_preload_libraries = 'pg_stat_statements'
-- 然后重启 PostgreSQL: pg_ctl restart 或 net stop/start postgresql
-- 
-- 验证: SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;

-- 创建扩展 (需 superuser 权限, 不阻塞已有查询)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 重置统计 (可选, 清理历史数据从当前基线开始)
SELECT pg_stat_statements_reset();

-- 确认扩展已加载
DO $$
BEGIN
  RAISE NOTICE 'pg_stat_statements installed: %', 
    (SELECT count(*) > 0 FROM pg_extension WHERE extname = 'pg_stat_statements');
END $$;
