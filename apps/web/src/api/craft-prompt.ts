/**
 * craft-prompt — CRAFT 提示词生成 API 客户端
 * 千机工坊
 *
 * 后端：/v1/craft-prompt/*（ai-orchestrator 8087）
 * 鉴权：Bearer JWT
 */

import axios, { type AxiosInstance } from "axios";
import {
  buildCraftPrompt,
  CAMERA_MOVEMENTS,
  MOOD_PRESETS,
  type CraftPrompt,
  type CraftGenerationRequest,
  type CameraMovement,
  type MoodPreset,
} from "@manhuaworks/shared-types";

/* ------------------------------------------------------------------ */
/*                            客户端                                   */
/* ------------------------------------------------------------------ */

const BASE = "/v1/craft-prompt";

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

class CraftPromptClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE,
      timeout: 30_000,
    });
  }

  /** 构建 CRAFT 提示词 */
  async build(req: CraftGenerationRequest): Promise<CraftPrompt> {
    try {
      const res = await this.client.post<{ code: number; data: CraftPrompt }>(
        "/build",
        req,
        { headers: authHeaders() },
      );
      return res.data.data;
    } catch (err) {
      if (!navigator.onLine) {
        return buildCraftPrompt(req);
      }
      throw err;
    }
  }

  /** 获取镜头运动库 */
  async getCameraMovements(): Promise<CameraMovement[]> {
    try {
      const res = await this.client.get<{ code: number; data: CameraMovement[] }>(
        "/camera-movements",
        { headers: authHeaders() },
      );
      return res.data.data;
    } catch {
      return CAMERA_MOVEMENTS;
    }
  }

  /** 获取情绪预设 */
  async getMoodPresets(): Promise<MoodPreset[]> {
    try {
      const res = await this.client.get<{ code: number; data: MoodPreset[] }>(
        "/mood-presets",
        { headers: authHeaders() },
      );
      return res.data.data;
    } catch {
      return MOOD_PRESETS;
    }
  }
}

export { CAMERA_MOVEMENTS, type CraftPrompt, type CraftGenerationRequest, type CameraMovement, type MoodPreset };
export const craftPromptApi = new CraftPromptClient();
