-- ManhuaWorks 业务种子数据
-- 2026-06-08 谢擎
-- 跑完 001a_core.sql 后再跑
-- 内容：1 个 admin + 4 个角色演示用户（role 1-4 各一） + 3 个项目场景 + 订阅/配额/调用日志

BEGIN;

-- ============ 5 个用户（覆盖 role 1=普通 2=会员 3=客服 4=运营 5=管理员） ============
-- admin@manhuaworks.local 是核心用户
INSERT INTO users (id, email, phone, display_name, role, status, password_hash) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@manhuaworks.local',  '+8613800000001', '系统管理员',   5, 1, 'argon2id$v=19$m=65536,t=3,p=4$YWRtaW5fc2FsdA$placeholder_admin_hash_2026'),
  ('00000000-0000-0000-0000-000000000002', 'normal@manhuaworks.local',  '+8613800000002', '小张-普通用户', 1, 1, 'argon2id$v=19$m=65536,t=3,p=4$bm9ybWFsX3NhbHQ$placeholder_normal_hash_2026'),
  ('00000000-0000-0000-0000-000000000003', 'pro@manhuaworks.local',     '+8613800000003', '老李-PRO会员',  2, 1, 'argon2id$v=19$m=65536,t=3,p=4$cHJvX3NhbHQ$placeholder_pro_hash_2026'),
  ('00000000-0000-0000-0000-000000000004', 'cs@manhuaworks.local',       '+8613800000004', '客服-小王',     3, 1, 'argon2id$v=19$m=65536,t=3,p=4$Y3Nfc2FsdA$placeholder_cs_hash_2026'),
  ('00000000-0000-0000-0000-000000000005', 'ops@manhuaworks.local',      '+8613800000005', '运营-小赵',     4, 1, 'argon2id$v=19$m=65536,t=3,p=4$b3BzX3NhbHQ$placeholder_ops_hash_2026');

-- ============ 5 条订阅（每个用户一条） ============
INSERT INTO subscriptions (user_id, plan, auto_renew, expires_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'team', TRUE,  NOW() + INTERVAL '365 days'),
  ('00000000-0000-0000-0000-000000000002', 'free', FALSE, NULL),
  ('00000000-0000-0000-0000-000000000003', 'pro',  TRUE,  NOW() + INTERVAL '30 days'),
  ('00000000-0000-0000-0000-000000000004', 'team', TRUE,  NOW() + INTERVAL '365 days'),
  ('00000000-0000-0000-0000-000000000005', 'team', TRUE,  NOW() + INTERVAL '365 days');

-- ============ 5 条配额（每个用户一条，team 配额更高） ============
INSERT INTO quotas (user_id, monthly_tokens, used_tokens, monthly_images, used_images, monthly_videos, used_videos) VALUES
  ('00000000-0000-0000-0000-000000000001', 5000000, 12000, 1000, 3,   200, 0),
  ('00000000-0000-0000-0000-000000000002', 100000,  4500,  50,   2,   10,  0),
  ('00000000-0000-0000-0000-000000000003', 1000000, 88000, 300,  25,  50,  2),
  ('00000000-0000-0000-0000-000000000004', 5000000, 22000, 1000, 8,   200, 1),
  ('00000000-0000-0000-0000-000000000005', 5000000, 31000, 1000, 12,  200, 1);

-- ============ 3 个项目场景（admin 的作品，覆盖 art_style 三种 + status 0/1/2 演示） ============
INSERT INTO projects (id, user_id, title, description, art_style, story_type, status) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '都市奇缘：晚安摩天楼',  '现代都市爱情喜剧，AI 写剧本 + 图像生成',  'modern',     'romance',    0),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '剑破苍穹：少年宗主',    '古风仙侠冒险长篇，已开工',            'xianxia',    'adventure',  1),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '深空遗民：第八殖民舰',  '近未来科幻，已完结首章',              'scifi',      'scifi',      2);

-- ============ 1 条 API 调用日志（admin 的一次 text 调用） ============
INSERT INTO api_call_logs (user_id, project_id, provider, model, call_type, input_tokens, output_tokens, cost_usd, latency_ms, status) VALUES
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'minimax', 'MiniMax-Text-01', 'text', 1200, 850, 0.002100, 1842, 0);

COMMIT;
