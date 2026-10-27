/**
 * useCraftPrompt — CRAFT 提示词生成器 composable
 * 千机工坊
 *
 * 功能：
 *   - buildPrompt(request)     → 调用后端 API 生成结构化 CRAFT 提示词
 *   - cameraMovements          → 镜头运动库（首次获取后缓存）
 *   - moodPresets              → 情绪预设（首次获取后缓存）
 *   - getMoodPreset(id)        → 按 id/中文名查找单个情绪预设
 *   - getCameraMovement(id)    → 按 id 查找单个镜头运动
 */

import { ref, computed, type Ref, type ComputedRef } from "vue";
import {
  craftPromptApi,
  type CraftPrompt,
  type CraftGenerationRequest,
  type CameraMovement,
  type MoodPreset,
} from "@/api/craft-prompt";

export interface UseCraftPromptReturn {
  /** 是否正在生成提示词 */
  building: Ref<boolean>;
  /** 上一次生成的结果 */
  lastPrompt: Ref<CraftPrompt | null>;
  /** 错误信息 */
  error: Ref<string | null>;
  /** 镜头运动库 */
  cameraMovements: Ref<CameraMovement[]>;
  /** 情绪预设 */
  moodPresets: Ref<MoodPreset[]>;
  /** 是否有结果 */
  hasPrompt: ComputedRef<boolean>;
  /** 完整提示词文本 */
  fullPromptText: ComputedRef<string>;

  /** 生成 CRAFT 提示词 */
  buildPrompt: (request: CraftGenerationRequest) => Promise<CraftPrompt | null>;
  /** 确保镜头运动和情绪预设已加载 */
  ensureLoaded: () => Promise<void>;
  /** 按 id 或中文名查找情绪预设 */
  getMoodPreset: (id: string) => MoodPreset | undefined;
  /** 按 id 查找镜头运动 */
  getCameraMovement: (id: string) => CameraMovement | undefined;
  /** 清除上次结果 */
  clear: () => void;
}

/**
 * CRAFT 提示词 composable
 */
export function useCraftPrompt(): UseCraftPromptReturn {
  const building = ref(false);
  const lastPrompt = ref<CraftPrompt | null>(null);
  const error = ref<string | null>(null);
  const cameraMovements = ref<CameraMovement[]>([]);
  const moodPresets = ref<MoodPreset[]>([]);

  let loaded = false;

  const hasPrompt = computed(() => lastPrompt.value !== null);
  const fullPromptText = computed(() => lastPrompt.value?.fullPrompt ?? "");

  /** 确保静态数据已加载（幂等） */
  async function ensureLoaded(): Promise<void> {
    if (loaded) return;
    try {
      const [movements, moods] = await Promise.all([
        craftPromptApi.getCameraMovements(),
        craftPromptApi.getMoodPresets(),
      ]);
      cameraMovements.value = movements;
      moodPresets.value = moods;
      loaded = true;
    } catch (err) {
      // 加载失败不阻断——后续可重试
      error.value = (err as Error).message;
    }
  }

  /** 生成 CRAFT 提示词 */
  async function buildPrompt(
    request: CraftGenerationRequest,
  ): Promise<CraftPrompt | null> {
    building.value = true;
    error.value = null;
    try {
      // 确保镜头/情绪数据已加载（构建 UI 需要展示选项）
      await ensureLoaded();
      const result = await craftPromptApi.build(request);
      lastPrompt.value = result;
      return result;
    } catch (err) {
      error.value = (err as Error).message;
      return null;
    } finally {
      building.value = false;
    }
  }

  /** 按 id 或中文名查找情绪预设 */
  function getMoodPreset(id: string): MoodPreset | undefined {
    const key = id.trim().toLowerCase();
    return moodPresets.value.find(
      (p) => p.id === key || p.nameZh === key,
    );
  }

  /** 按 id 查找镜头运动 */
  function getCameraMovement(id: string): CameraMovement | undefined {
    return cameraMovements.value.find((m) => m.id === id);
  }

  /** 清除上次结果 */
  function clear(): void {
    lastPrompt.value = null;
    error.value = null;
  }

  return {
    building,
    lastPrompt,
    error,
    cameraMovements,
    moodPresets,
    hasPrompt,
    fullPromptText,
    buildPrompt,
    ensureLoaded,
    getMoodPreset,
    getCameraMovement,
    clear,
  };
}
