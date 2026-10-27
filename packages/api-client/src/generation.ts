/**
 * ManhuaWorks - api-client
 * generation module — AI generation task management (image/video/audio/tts)
 */

import type { HttpModule, GenerationModule } from './types.js'
import type {
  GenerationTask, GenerationSubmitRequest, GenerationListOptions,
} from './types.js'

export function createGeneration(http: HttpModule): GenerationModule {
  return {
    /**
     * Submit a new generation task.
     * Returns { taskId, status, requestHash }.
     * Dedup: same prompt+params+userId returns existing task.
     */
    async submit(request: GenerationSubmitRequest) {
      return await http.post<{ taskId: string; status: string; requestHash: string }>(
        '/generation/submit',
        request,
      )
    },

    /**
     * Get a generation task by ID.
     */
    async get(taskId: string) {
      return await http.get<GenerationTask>(`/generation/${encodeURIComponent(taskId)}`)
    },

    /**
     * List generation tasks with optional filters.
     */
    async list(opts: GenerationListOptions = {}) {
      return await http.get<{ items: GenerationTask[]; total: number }>(
        '/generation',
        opts as Record<string, unknown>,
      )
    },

    /**
     * Cancel a queued or running generation task.
     */
    async cancel(taskId: string) {
      await http.post<void>(`/generation/${encodeURIComponent(taskId)}/cancel`, {})
    },
  }
}
