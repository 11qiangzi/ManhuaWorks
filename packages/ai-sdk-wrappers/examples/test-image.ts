/**
 * 图像模型测试样例
 *
 * 用法：
 *   pnpm --filter @manhuaworks/ai-sdk-wrappers examples:image
 *
 * 演示：
 *   1. 4 家供应商 generate
 *   2. volcengine seedream 的 edit（image2image）
 *   3. 不支持 edit / variations 的供应商抛 NotSupportedError
 */

import {
  createMiniMaxImage,
  createVolcengineSeedream,
  createZhipuCogview,
  createDeepSeekJimeng,
  NotSupportedError,
  PACKAGE_NAME,
  VERSION,
  type ImageProvider,
  type ImageRequestCommon,
  type ImageResult,
} from '../src/index.js';

interface VendorCase {
  name: string;
  factory: (key: string) => ImageProvider;
  envKey: string;
}

async function main() {
  console.log(`[${PACKAGE_NAME} v${VERSION}] image test\n`);

  const cases: VendorCase[] = [
    { name: 'MiniMax image-01',           envKey: 'MINIMAX_API_KEY',    factory: (k) => createMiniMaxImage({ apiKey: k }) },
    { name: 'volcengine seedream',        envKey: 'VOLCENGINE_API_KEY', factory: (k) => createVolcengineSeedream({ apiKey: k }) },
    { name: 'zhipu cogview-3',            envKey: 'ZHIPU_API_KEY',      factory: (k) => createZhipuCogview({ apiKey: k }) },
    { name: 'deepseek jimeng',            envKey: 'DEEPSEEK_API_KEY',   factory: (k) => createDeepSeekJimeng({ apiKey: k }) },
  ];

  for (const c of cases) {
    const apiKey = process.env[c.envKey];
    if (!apiKey) {
      console.log(`[${c.name}] skip (no ${c.envKey})`);
      continue;
    }
    try {
      const provider = c.factory(apiKey);
      const results = (await provider.generate({
        prompt: 'a tiny cute cat sitting on a book, watercolor style',
        size: '1024x1024',
        n: 1,
        returnBinary: false,
      } as ImageRequestCommon));
      const first = results[0] as ImageResult | undefined;
      if (first?.url) {
        console.log(`[${c.name}] ok url=${first.url.slice(0, 80)}...`);
      } else if (first?.binary) {
        console.log(`[${c.name}] ok binary=${first.binary.length} bytes mime=${first.mimeType}`);
      } else {
        console.log(`[${c.name}] no result`);
      }
    } catch (err) {
      console.log(`[${c.name}] failed: ${(err as Error).message}`);
    }
  }
  console.log();

  // 2. volcengine edit
  if (process.env.VOLCENGINE_API_KEY) {
    console.log('=== volcengine edit (image2image) ===');
    const provider = createVolcengineSeedream({ apiKey: process.env.VOLCENGINE_API_KEY });
    try {
      // 用一张 1x1 png 试一下，让服务器端不空
      const onePx = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      const results = await provider.edit({
        prompt: 'convert to oil painting',
        source: onePx,
        size: '1024x1024',
        n: 1,
        returnBinary: false,
      });
      console.log(`volcengine edit ok count=${results.length}`);
    } catch (err) {
      console.log(`volcengine edit failed: ${(err as Error).message}`);
    }
    console.log();
  }

  // 3. NotSupported 演示
  console.log('=== NotSupportedError check ===');
  const mm = createMiniMaxImage({ apiKey: 'dummy' });
  try {
    await mm.edit({ prompt: 'x', source: 'y' } as unknown as Parameters<typeof mm.edit>[0]);
  } catch (err) {
    if (err instanceof NotSupportedError) {
      console.log(`OK: ${err.provider} does not support ${err.op}`);
    } else {
      console.log(`unexpected error: ${(err as Error).message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
