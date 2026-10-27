import { ref } from 'vue'

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export function useAgentChat() {
  const agentMessages = ref<AgentMessage[]>([
    { role: 'assistant', content: '你好！我是 AI 工作流助手 🤖\n\n你可以用自然语言描述你想要的工作流，我会帮你在画布上自动搭建。试试说：\n• "帮我建一个动画生成流水线"\n• "加一个翻译节点"\n• "把所有节点连起来"\n• "优化当前工作流"', timestamp: Date.now() },
  ])
  const agentInput = ref('')
  const agentLoading = ref(false)

  const quickCommands = [
    { label: '📖 建动画流', cmd: '帮我建一个完整的动画生成流水线，从剧本到风格迁移' },
    { label: '🌐 加翻译', cmd: '加一个翻译节点' },
    { label: '🔄 优化布局', cmd: '优化当前所有节点的布局' },
    { label: '📋 列出节点', cmd: '列出当前画布上所有节点' },
  ]

  function addMessage(role: AgentMessage['role'], content: string) {
    agentMessages.value.push({ role, content, timestamp: Date.now() })
  }

  async function sendAgentCommand(text?: string) {
    const msg = (text ?? agentInput.value).trim()
    if (!msg || agentLoading.value) return
    addMessage('user', msg)
    agentInput.value = ''
    agentLoading.value = true

    // Simulated AI response (production: call /v1/agent/chat)
    await new Promise(r => setTimeout(r, 800))
    const responses: Record<string, string> = {
      '分析当前工作流': '当前工作流包含 novel-to-drama → style-transfer 链路，预计执行时间约 45s，成本约 $0.35。建议添加 error-handler 节点提升容错。',
      '优化建议': '1. 将 image-gen 节点拆分为并行执行可节省 30% 时间\n2. 添加 compose 节点自动合成最终视频\n3. 考虑使用 episode-batch 批量处理多章节',
      '预估成本': '根据当前节点配置：\n- storyboard: $0.15\n- character: $0.20\n- image-gen ×6: $2.40\n- tts: $0.10\n- 总计约 $2.85',
      '添加节点': '已为你在画布中心添加一个 novel-to-drama 节点。你可以在右侧属性面板中配置 storyType 和 artStyle 参数。',
    }
    const reply = responses[msg] ?? `收到你的指令「${msg}」。当前为本地 mock 模式，接入 AI Agent 后可获得智能回复。`
    addMessage('assistant', reply)
    agentLoading.value = false
  }

  function handleAgentKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendAgentCommand()
    }
  }

  return {
    agentMessages, agentInput, agentLoading, quickCommands,
    addMessage, sendAgentCommand, handleAgentKeydown,
  }
}
