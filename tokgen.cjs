// tokgen.cjs — 手动签 JWT (测试用)
// 用法: node tokgen.cjs <userId> <role>
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-jwt-secret-replace-in-prod-2026-06-08-min-32-chars';

const userId = process.argv[2] || '00000000-0000-0000-0000-000000000001';
const role = parseInt(process.argv[3] || '5', 10);
const email = process.argv[4] || 'admin@manhuaworks.local';
const displayName = process.argv[5] || '系统管理员';

const token = jwt.sign(
  { sub: userId, email, role, displayName, typ: 'access' },
  JWT_SECRET,
  { expiresIn: '7d', algorithm: 'HS256' }
);

console.log(token);
