/**
 * Provider Key验证
 *
 * 用最小的 API调用试探 key 是否有效：
 * - openai: GET https://api.openai.com/v1/models
 * - anthropic: GET https://api.anthropic.com/v1/models
 * - google: GET https://generativelanguage.googleapis.com/v1beta/models?key=...
 * - azure_openai: GET https://{endpoint}/openai/deployments?api-version=...
 * - stability: GET https://api.stability.ai/v1/user/account
 * - deepseek: GET https://api.deepseek.com/v1/models
 * - qwen / siliconflow: 类似 OpenAI协议
 * - 其他：先跳过，只能让用户自己确认
 *
 *失败不算"错"（可能是网络问题），只更新 last_error供人查。
 *成功就更新 last_used_at。
 *
 * 安全：
 * - 不打印明文 key
 * - 所有外发请求都带 timeout
 */

import { config } from "../config.js";

export interface ValidateResult {
 ok: boolean;
 provider: string;
 latencyMs: number;
 error?: string;
 detail?: Record<string, unknown>;
}

export async function validateApiKey(
 provider: string,
 apiKey: string,
 options?: { endpoint?: string }
): Promise<ValidateResult> {
 const t0 = Date.now();

 try {
 switch (provider) {
 case "openai":
 return await validateOpenAI(apiKey, t0);
 case "anthropic":
 return await validateAnthropic(apiKey, t0);
 case "google":
 return await validateGoogle(apiKey, t0);
 case "azure_openai":
 return await validateAzureOpenAI(apiKey, options?.endpoint, t0);
 case "stability":
 return await validateStability(apiKey, t0);
 case "deepseek":
 return await validateOpenAICompat(
 apiKey,
 "https://api.deepseek.com/v1/models",
 t0
 );
 case "qwen":
 return await validateOpenAICompat(
 apiKey,
 "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
 t0
 );
 case "siliconflow":
 return await validateOpenAICompat(
 apiKey,
 "https://api.siliconflow.cn/v1/models",
 t0
 );
 case "midjourney":
 case "runway":
 case "replicate":
 return {
 ok: true,
 provider,
 latencyMs: Date.now() - t0,
 detail: { note: "skipped_remote_check_unsupported" },
 };
 case "other":
 default:
 return {
 ok: true,
 provider,
 latencyMs: Date.now() - t0,
 detail: { note: "skipped_remote_check_unknown_provider" },
 };
 }
 } catch (err) {
 return {
 ok: false,
 provider,
 latencyMs: Date.now() - t0,
 error: err instanceof Error ? err.message : String(err),
 };
 }
}

/* ───────────────────────── OpenAI ───────────────────────── */
async function validateOpenAI(
 apiKey: string,
 t0: number
): Promise<ValidateResult> {
 const res = await fetchWithTimeout(
 "https://api.openai.com/v1/models",
 {
 headers: {
 Authorization: `Bearer ${apiKey}`,
 },
 },
 config.VALIDATE_TIMEOUT_MS
 );
 return finalize(res, "openai", t0);
}

/* ─────────────────────── Anthropic ─────────────────────── */
async function validateAnthropic(
 apiKey: string,
 t0: number
): Promise<ValidateResult> {
 const res = await fetchWithTimeout(
 "https://api.anthropic.com/v1/models",
 {
 headers: {
 "x-api-key": apiKey,
 "anthropic-version": "2023-06-01",
 },
 },
 config.VALIDATE_TIMEOUT_MS
 );
 return finalize(res, "anthropic", t0);
}

/* ───────────────────────── Google ───────────────────────── */
async function validateGoogle(
 apiKey: string,
 t0: number
): Promise<ValidateResult> {
 const res = await fetchWithTimeout(
 `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
 apiKey
 )}`,
 {},
 config.VALIDATE_TIMEOUT_MS
 );
 return finalize(res, "google", t0);
}

/* ─────────────────────── Azure OpenAI ─────────────────────── */
async function validateAzureOpenAI(
 apiKey: string,
 endpoint: string | undefined,
 t0: number
): Promise<ValidateResult> {
 if (!endpoint) {
 return {
 ok: false,
 provider: "azure_openai",
 latencyMs: Date.now() - t0,
 error: "azure_openai requires endpoint (e.g. https://xxx.openai.azure.com)",
 };
 }
 const url = `${endpoint.replace(/\/$/, "")}/openai/deployments?api-version=2024-02-01`;
 const res = await fetchWithTimeout(
 url,
 {
 headers: { "api-key": apiKey },
 },
 config.VALIDATE_TIMEOUT_MS
 );
 return finalize(res, "azure_openai", t0);
}

/* ───────────────────────── Stability ───────────────────────── */
async function validateStability(
 apiKey: string,
 t0: number
): Promise<ValidateResult> {
 const res = await fetchWithTimeout(
 "https://api.stability.ai/v1/user/account",
 {
 headers: {
 Authorization: `Bearer ${apiKey}`,
 },
 },
 config.VALIDATE_TIMEOUT_MS
 );
 return finalize(res, "stability", t0);
}

/* ──────────────────── OpenAI兼容协议（DeepSeek/Qwen/SF） ──────────────────── */
async function validateOpenAICompat(
 apiKey: string,
 url: string,
 t0: number
): Promise<ValidateResult> {
 const res = await fetchWithTimeout(
 url,
 {
 headers: { Authorization: `Bearer ${apiKey}` },
 },
 config.VALIDATE_TIMEOUT_MS
 );
 return finalize(res, "openai_compat", t0);
}

/* ────────────────────────────工具 ──────────────────────────── */

async function fetchWithTimeout(
 url: string,
 init: RequestInit,
 timeoutMs: number
): Promise<Response> {
 const controller = new AbortController();
 const tid = setTimeout(() => controller.abort(), timeoutMs);
 try {
 const res = await fetch(url, { ...init, signal: controller.signal });
 return res;
 } finally {
 clearTimeout(tid);
 }
}

function finalize(
 res: Response,
 provider: string,
 t0: number
): ValidateResult {
 const latencyMs = Date.now() - t0;
 if (res.status ===200 || res.status ===201) {
 return { ok: true, provider, latencyMs };
 }
 //401/403 = key无效；其他 = 网络/服务端问题
 const isAuthError = res.status ===401 || res.status ===403;
 return {
 ok: false,
 provider,
 latencyMs,
 error: isAuthError
 ? `auth_failed_status_${res.status}`
 : `unexpected_status_${res.status}`,
 detail: { status: res.status },
 };
}
