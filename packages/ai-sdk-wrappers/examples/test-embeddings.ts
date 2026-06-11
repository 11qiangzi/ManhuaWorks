/**
 * 嵌入模型测试样例
 *
 * 用法：
 *   pnpm --filter @manhuaworks/ai-sdk-wrappers examples:embeddings
 *
 * 演示：
 *   1. 本地 all-MiniLM-L6-v2（无需 API key）
 *   2. 远程 4 家供应商（需要环境变量，缺 key 时跳过）
 *   3. 与 VectorStore 打通（需要 Postgres+pgvector）
 */

import { localMiniLM, createRemoteEmbedding, VectorStore, cosine01, VERSION, PACKAGE_NAME } from '../src/index.js';

async function main() {
  console.log(`[${PACKAGE_NAME} v${VERSION}] embedding test\n`);

  // 1. 本地嵌入
  console.log('=== local MiniLM (384d) ===');
  const t0 = Date.now();
  const v1 = await localMiniLM.embed('在霓虹灯下奔跑的少女，赛博朋克风格');
  const t1 = Date.now();
  console.log(`dim=${v1.dim} provider=${v1.provider} model=${v1.model} cost=${t1 - t0}ms`);
  console.log(`head5=${v1.values.slice(0, 5).map((x) => x.toFixed(4)).join(',')}\n`);

  const v2 = await localMiniLM.embed('赛博朋克少女在雨中站立');
  console.log('相似度（同主题）: ', cosine01(v1.values, v2.values).toFixed(4));

  const v3 = await localMiniLM.embed('一只金毛犬在公园里追飞盘');
  console.log('相似度（不同主题）:', cosine01(v1.values, v3.values).toFixed(4), '\n');

  // 批量
  const batchT0 = Date.now();
  const batch = await localMiniLM.embedBatch([
    'A',
    'B',
    'C',
    'D',
    'E',
  ]);
  const batchT1 = Date.now();
  console.log(`batch[5] cost=${batchT1 - batchT0}ms -> ${batch.length} vectors\n`);

  // 2. 远程供应商
  const remoteCases: { id: 'minimax' | 'volcengine' | 'zhipu' | 'deepseek'; envKey: string; model: string; dim: number }[] = [
    { id: 'minimax',     envKey: 'MINIMAX_API_KEY',     model: 'embo-01',                       dim: 1536 },
    { id: 'volcengine',  envKey: 'VOLCENGINE_API_KEY',  model: 'doubao-embedding-text-240715',  dim: 1024 },
    { id: 'zhipu',       envKey: 'ZHIPU_API_KEY',       model: 'embedding-2',                   dim: 1024 },
    { id: 'deepseek',    envKey: 'DEEPSEEK_API_KEY',    model: 'deepseek-embed',                dim: 1024 },
  ];

  for (const c of remoteCases) {
    const apiKey = process.env[c.envKey];
    if (!apiKey) {
      console.log(`[${c.id}] skip (no ${c.envKey})`);
      continue;
    }
    try {
      const provider = createRemoteEmbedding(c.id, { apiKey, model: c.model, dim: c.dim });
      const v = await provider.embed('hello world');
      console.log(`[${c.id}] dim=${v.dim} model=${v.model} ok`);
    } catch (err) {
      console.log(`[${c.id}] failed: ${(err as Error).message}`);
    }
  }
  console.log();

  // 3. VectorStore 集成（可选）
  const pgUrl = process.env.PG_VECTOR_URL;
  if (pgUrl) {
    console.log('=== VectorStore (pgvector) ===');
    const store = new VectorStore({ connectionString: pgUrl, dim: 384 });
    try {
      await store.migrate();
      await store.upsertFromEmbedding('demo', 'doc-1', v1, 'doc-1 source text');
      await store.upsertFromEmbedding('demo', 'doc-2', v2, 'doc-2 source text');
      await store.upsertFromEmbedding('demo', 'doc-3', v3, 'doc-3 source text');

      const hits = await store.search('demo', v1.values, 3);
      console.log('top3:', hits.map((h) => `${h.refId}=${h.score.toFixed(4)}`).join(' '));
    } finally {
      await store.close();
    }
  } else {
    console.log('[VectorStore] skip (no PG_VECTOR_URL)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
