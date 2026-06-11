// =============================================================================
// useHistory.ts — 撤销/重做（基于命令模式）
// W5 任务 3
// =============================================================================

import { ref, computed } from 'vue'
import type { HistoryCommand } from '../types/workflow'

const MAX_HISTORY = 100

export function useHistory() {
  const undoStack = ref<HistoryCommand[]>([])
  const redoStack = ref<HistoryCommand[]>([])

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  function execute(cmd: Omit<HistoryCommand, 'timestamp'>) {
    cmd.do()
    const full: HistoryCommand = { ...cmd, timestamp: Date.now() }
    undoStack.value.push(full)
    if (undoStack.value.length > MAX_HISTORY) undoStack.value.shift()
    // 执行新命令清空 redo
    redoStack.value = []
  }

  function undo() {
    const cmd = undoStack.value.pop()
    if (!cmd) return
    cmd.undo()
    redoStack.value.push(cmd)
  }

  function redo() {
    const cmd = redoStack.value.pop()
    if (!cmd) return
    cmd.do()
    undoStack.value.push(cmd)
  }

  function clear() {
    undoStack.value = []
    redoStack.value = []
  }

  function batch(label: string, cmds: Array<Omit<HistoryCommand, 'label' | 'timestamp'>>) {
    const doAll = () => cmds.forEach(c => c.do())
    const undoAll = () => cmds.slice().reverse().forEach(c => c.undo())
    execute({ type: 'batch', do: doAll, undo: undoAll, label })
  }

  return {
    undoStack,
    redoStack,
    canUndo,
    canRedo,
    execute,
    undo,
    redo,
    clear,
    batch,
  }
}
