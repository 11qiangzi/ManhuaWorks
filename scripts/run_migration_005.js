const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  database: 'manhuaworks',
  user: 'mhw',
  password: 'mhw_dev_password_2026',
});

const fs = require('fs');
const path = require('path');

async function run() {
  // 1. Run migration
  const migrationFile = path.join(__dirname, '..', 'docs', 'database', 'migrations', '005_content_review_logs.sql');
  const sql = fs.readFileSync(migrationFile, 'utf-8');
  console.log('Running migration 005...');
  await pool.query(sql);
  console.log('Migration 005 applied.');

  // 2. Check existing data
  const contentCheck = await pool.query('SELECT COUNT(*)::int AS c FROM content_review');
  const logsCheck = await pool.query('SELECT COUNT(*)::int AS c FROM system_logs');
  console.log(`content_review: ${contentCheck.rows[0].c} rows`);
  console.log(`system_logs: ${logsCheck.rows[0].c} rows`);

  // 3. Seed sample content_review data
  if (Number(contentCheck.rows[0].c) === 0) {
    const seedContent = [
      ["a0000000-0000-0000-0000-000000000001", "creator_demo", "花样年华风格插画", "image", "pending", "AI 内容待审核", "/thumbs/img_001.png"],
      ["a0000000-0000-0000-0000-000000000001", "creator_demo", "都市夜景分镜_03", "video", "pending", "自动检测: 暴力内容 0.32", "/thumbs/vid_001.png"],
      ["a0000000-0000-0000-0000-000000000002", "artist_li", "水墨风格角色设计", "image", "approved", null, "/thumbs/img_002.png"],
      ["a0000000-0000-0000-0000-000000000003", "writer_wang", "对话脚本生成_最终版", "text", "pending", "AI 内容待审核", null],
      ["a0000000-0000-0000-0000-000000000001", "creator_demo", "动漫风格转绘", "model", "rejected", "版权风险 - 疑似第三方素材", "/thumbs/model_001.png"],
      ["a0000000-0000-0000-0000-000000000004", "studio_x", "快速漫画生成器输出", "image", "pending", "批量生成标记", "/thumbs/img_003.png"],
      ["a0000000-0000-0000-0000-000000000002", "artist_li", "角色表情集_愤怒", "image", "approved", null, "/thumbs/img_004.png"],
      ["a0000000-0000-0000-0000-000000000005", "新用户_zhang", "测试输出_01", "text", "pending", "新用户内容审查", null],
    ];
    for (const [uid, uname, title, type, status, reason, thumb] of seedContent) {
      await pool.query(
        `INSERT INTO content_review (user_id, username, title, type, status, flag_reason, thumbnail_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [uid, uname, title, type, status, reason || null, thumb || null]
      );
    }
    console.log('Seeded 8 content_review rows.');
  }

  // 4. Seed sample system_logs data
  if (Number(logsCheck.rows[0].c) === 0) {
    const now = new Date();
    const seedLogs = [
      ["api-gateway", "INFO", "POST /api/v1/auth/login — 200 in 45ms", now],
      ["image-gen", "INFO", "Job img_a8xK completed — sdxl, seed=42, 3.2s", new Date(now - 300)],
      ["user-service", "INFO", "User login: creator@mhw.com — method=email", new Date(now - 400)],
      ["ai-orchestrator", "INFO", "Workflow wf_main started — 6 nodes", new Date(now - 500)],
      ["image-gen", "DEBUG", "Warmup completed — gpu=0 memory=8.2G/12G", new Date(now - 800)],
      ["billing-service", "WARN", "User credit low — available 3, needed 15", new Date(now - 1000)],
      ["health-check", "INFO", "Provider test: DeepSeek=OK(189ms), OpenAI=OK(326ms)", new Date(now - 1200)],
      ["image-gen", "ERROR", "BYOK provider=bytes — API error 401 Unauthorized", new Date(now - 1500)],
      ["api-gateway", "INFO", "GET /api/v1/projects?limit=6 — 200 in 18ms", new Date(now - 2000)],
      ["project-service", "INFO", "Project=proj_1 updated — user=creator@mhw.com", new Date(now - 3000)],
      ["user-service", "INFO", "User register: new_user@gmail.com", new Date(now - 4000)],
      ["collab-service", "WARN", "Team size limit approaching — team_name=创作工坊, 48/50", new Date(now - 5000)],
      ["billing-service", "INFO", "Recharge: user=artist_li, amount=99.00, method=wechat", new Date(now - 6000)],
      ["api-gateway", "ERROR", "GET /api/v1/projects/proj_bad — 404 in 3ms", new Date(now - 7000)],
      ["project-service", "INFO", "Scene auto-save: project=proj_3, scene=scene_12", new Date(now - 8000)],
    ];
    for (const [svc, level, msg, ts] of seedLogs) {
      await pool.query(
        `INSERT INTO system_logs (service, level, message, created_at)
         VALUES ($1,$2,$3,$4)`,
        [svc, level, msg, ts]
      );
    }
    console.log('Seeded 15 system_logs rows.');
  }

  await pool.end();
  console.log('Done.');
}

run().catch(e => { console.error(e); process.exit(1); });
