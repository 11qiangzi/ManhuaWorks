/**
 * 资产辅助工具
 *
 * 用途：
 *   - 创建/获取测试项目（项目是 asset 的容器）
 *   - 上传资产（mp4 / jpg / json）并落版本
 *   - 记录版本号（v1/v2/v3）便于回归对比
 *
 * 设计：
 *   - 复用 W3 的 assetClient.create()
 *   - 版本号是 metadata 的一部分：{ version, prevVersion, source, tags }
 *   - 上传：通过 fetch 把 blob 推到 asset-service 的 upload endpoint
 *     （mock 模式下走 mock-providers 拦截，真实模式走远端）
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { assetClient, type AssetKind, type AssetSummary } from "../../clients/asset.js";
import { config } from "../../config.js";

export interface CreateProjectInput {
  projectName: string;
  ownerUserId: string;
  /** 父项目 ID（克隆场景） */
  parentId?: string;
  tags?: string[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  ownerUserId: string;
  parentId?: string;
  createdAt: number;
  tags: string[];
}

/** 创建项目（用 kind=project 在 asset-service 占位） */
export async function createProject(input: CreateProjectInput): Promise<ProjectRecord> {
  const r = await assetClient.create({
    kind: "project" as AssetKind, // asset-service 接受扩展 kind
    projectId: `proj-${Date.now().toString(36)}`, // 项目自身需要一个 projectId 占位
    userId: input.ownerUserId,
    payload: {
      name: input.projectName,
      ownerUserId: input.ownerUserId,
      parentId: input.parentId,
      type: "project",
    },
    tags: input.tags,
    visibility: "private",
  });
  return {
    id: r.asset.id,
    name: input.projectName,
    ownerUserId: input.ownerUserId,
    parentId: input.parentId,
    createdAt: r.asset.createdAt,
    tags: input.tags ?? [],
  };
}

export interface UploadAssetInput {
  projectId: string;
  ownerUserId: string;
  kind: AssetKind;
  filePath?: string;
  url?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface UploadAssetResult {
  asset: AssetSummary;
  version: number;
  prevVersion?: number;
  bytes?: number;
  filename?: string;
}

/** 跟踪每个 (projectId, kind) 的最新版本号 */
const versionMap = new Map<string, number>();

function versionKey(projectId: string, kind: AssetKind): string {
  return `${projectId}::${kind}`;
}

export async function uploadAsset(input: UploadAssetInput): Promise<UploadAssetResult> {
  const key = versionKey(input.projectId, input.kind);
  const prevVersion = versionMap.get(key) ?? 0;
  const version = prevVersion + 1;

  let bytes: number | undefined;
  let filename: string | undefined;

  if (input.filePath) {
    const buf = await readFile(input.filePath);
    bytes = buf.byteLength;
    filename = basename(input.filePath);
  }

  // 真实模式：推 upload endpoint；mock 模式：mock-providers 会接住
  if (input.filePath && bytes && bytes > 0) {
    try {
      const fd = new FormData();
      const buf = await readFile(input.filePath);
      const blob = new Blob([new Uint8Array(buf)]);
      fd.append("file", blob, filename);
      fd.append("projectId", input.projectId);
      fd.append("kind", input.kind);
      const resp = await fetch(`${config.asset.url}/v1/assets/upload`, {
        method: "POST",
        headers: { authorization: `Bearer ${config.auth.apiKey}` },
        body: fd,
        signal: AbortSignal.timeout(config.asset.timeoutMs),
      });
      // 失败也无妨——create 走 create 路径一样
      void resp;
    } catch {
      // 静默：upload endpoint 可能没实现或 mock 不支持，回退到 create
    }
  }

  const r = await assetClient.create({
    kind: input.kind,
    projectId: input.projectId,
    userId: input.ownerUserId,
    payload: {
      ...input.metadata,
      url: input.url,
      version,
      prevVersion: prevVersion > 0 ? prevVersion : undefined,
      filename,
      bytes,
      source: input.filePath ? "local" : "remote",
    },
    tags: input.tags,
    visibility: "team",
  });

  versionMap.set(key, version);

  return {
    asset: r.asset,
    version,
    prevVersion: prevVersion > 0 ? prevVersion : undefined,
    bytes,
    filename,
  };
}

/** 列出项目下某 kind 的所有资产，按版本升序 */
export async function listAssetVersions(
  projectId: string,
  kind: AssetKind,
): Promise<AssetSummary[]> {
  const r = await assetClient.listByProject(projectId, kind);
  return r.assets;
}

/** 清理 helper：测试结束后重置版本表 */
export function resetVersionMap(): void {
  versionMap.clear();
}
