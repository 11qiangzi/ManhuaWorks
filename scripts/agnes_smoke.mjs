import { readFileSync } from 'node:fs';

const envPath = 'D:/ManhuaWorks/services/ai-router/.env';
const env = readFileSync(envPath, 'utf8');
const getEnv = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : null;
};
const key = getEnv('AGNES_API_KEY');
const base = (getEnv('AGNES_BASE_URL') || 'https://apihub.agnes-ai.com/v1').replace(/\/$/, '');

if (!key) { console.error('NO AGNES_API_KEY in .env'); process.exit(1); }
console.log('Key:', key.slice(0, 4) + '...' + key.slice(-4));
console.log('Base:', base);

const body = {
  model: 'agnes-image-2.1-flash',
  prompt: 'A cute cartoon cat sitting on a wooden chair, soft studio lighting, flat illustration style, high quality, no text',
  size: '1024x1024',
  n: 1,
};

const t0 = Date.now();
try {
  const res = await fetch(`${base}/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log('HTTP', res.status, 'in', Date.now() - t0, 'ms');
  let data;
  try { data = JSON.parse(text); } catch { console.log('RAW:', text.slice(0, 600)); process.exit(2); }
  const urls = (data.data ?? []).map((d) => d.url).filter(Boolean);
  console.log('image URLs:', urls.length);
  urls.forEach((u) => console.log('  ->', u));
  if (res.status === 200 && urls.length) console.log('RESULT: OK (Agnes key valid + balance sufficient)');
  else console.log('RESULT: non-200 or empty — check status/body above');
} catch (e) {
  console.error('FETCH ERROR:', e.message);
  process.exit(3);
}
