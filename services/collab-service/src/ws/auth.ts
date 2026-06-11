/**
 * WS 握手时校验 JWT
 *  - 优先 query.token
 *  - 回退到 Sec-WebSocket-Protocol (auth-bearer)
 *  - 也支持 Authorization header
 */
import type { IncomingMessage } from "node:http";
import { verifyToken } from "@manhuaworks/shared";
import type { AuthUser } from "@manhuaworks/shared";

export function authenticateUpgrade(req: IncomingMessage): AuthUser | null {
  // 1) query.token
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const qToken = url.searchParams.get("token");
    if (qToken) {
      const u = verifyToken(qToken);
      if (u) return u;
    }
  } catch {
    // ignore
  }
  // 2) Authorization header
  const auth = req.headers["authorization"];
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const u = verifyToken(auth.slice(7).trim());
    if (u) return u;
  }
  // 3) Sec-WebSocket-Protocol: auth-bearer-<token>
  const proto = req.headers["sec-websocket-protocol"];
  if (typeof proto === "string" && proto.toLowerCase().startsWith("auth-bearer-")) {
    const token = proto.slice("auth-bearer-".length).trim();
    const u = verifyToken(token);
    if (u) return u;
  }
  return null;
}

export function extractClientId(req: IncomingMessage, fallback: string): string {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    return url.searchParams.get("clientId") ?? fallback;
  } catch {
    return fallback;
  }
}

export function extractClientIp(req: IncomingMessage): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0]?.trim() ?? null;
  return req.socket?.remoteAddress ?? null;
}
