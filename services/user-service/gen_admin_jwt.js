const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const secret = 'dev-only-jwt-secret-replace-in-prod-2026-06-08-min-32-chars';
const now = Math.floor(Date.now() / 1000);
const tok = jwt.sign(
  { sub: 'a0000000-0000-0000-0000-000000000001', role: 5, typ: 'access' },
  secret,
  { expiresIn: '2h', issuer: 'manhuaworks', jwtid: crypto.randomUUID() }
);
console.log(tok);
