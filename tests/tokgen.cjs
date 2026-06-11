// tokgen.cjs - generate a properly iss/aud JWT for billing
const c = require('node:crypto');
const SECRET = 'dev-only-jwt-secret-replace-in-prod-2026-06-08-min-32-chars';
const b64u = (o) => Buffer.from(o).toString('base64')
  .replace(/=+$/, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');
const sub = process.argv[2] || 'a594b7cb-1c3c-4926-8160-dd02cd960dad';
const h = b64u(JSON.stringify({alg:'HS256',typ:'JWT'}));
const now = Math.floor(Date.now()/1000);
const p = b64u(JSON.stringify({
  sub, role:1, email:'x@y.z', typ:'access',
  iss:'manhuaworks', aud:'manhuaworks-api',
  iat: now, exp: now + 3600
}));
const sig = c.createHmac('sha256', SECRET).update(h+'.'+p).digest('base64')
  .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const tok = h+'.'+p+'.'+sig;

// Verify it
const jwt = require('D:/ManhuaWorks/services/billing-service/node_modules/jsonwebtoken');
try {
  const d = jwt.verify(tok, SECRET, {algorithms:['HS256'], issuer:'manhuaworks', audience:'manhuaworks-api'});
  console.log('OK:', JSON.stringify(d));
  // Output token to file
  require('fs').writeFileSync('D:/ManhuaWorks/tests/.tok.txt', tok);
  console.log('WROTE_D:/ManhuaWorks/tests/.tok.txt');
} catch (e) { console.log('FAIL:', e.name, e.message); }
