<script setup lang="ts">
/**
 * FailoverIndicator - 故障转移状态指示器
 * ManhuaWorks studio component
 *
 * 展示 AI 供应商故障转移链路状态（紧凑/完整模式）
 */

interface Props {
  /** 紧凑模式（仅图标 + 短文案） */
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  compact: false
})

/** 模拟故障转移节点状态 */
interface FailoverNode {
  provider: string
  label: string
  status: 'active' | 'standby' | 'offline'
  latencyMs: number
}

const nodes: FailoverNode[] = [
  { provider: 'openai', label: 'OpenAI', status: 'active', latencyMs: 120 },
  { provider: 'anthropic', label: 'Anthropic', status: 'standby', latencyMs: 95 },
  { provider: 'google', label: 'Google', status: 'standby', latencyMs: 180 },
  { provider: 'stability', label: 'Stability', status: 'offline', latencyMs: 0 }
]

const activeCount = nodes.filter((n) => n.status !== 'offline').length
const activeNode = nodes.find((n) => n.status === 'active')
</script>

<template>
  <div class="failover" :class="{ 'failover--compact': props.compact }">
    <!-- 紧凑模式 -->
    <template v-if="props.compact">
      <div class="failover__compact">
        <span class="failover__dot failover__dot--active" />
        <span class="failover__compact-text">
          故障转移就绪 · {{ activeCount }} 节点在线
          <template v-if="activeNode"> · 当前 {{ activeNode.label }}</template>
        </span>
      </div>
    </template>

    <!-- 完整模式 -->
    <template v-else>
      <div class="failover__header">
        <h3 class="failover__title">故障转移链路</h3>
        <span class="failover__badge">{{ activeCount }}/{{ nodes.length }} 在线</span>
      </div>
      <div class="failover__chain">
        <template v-for="(node, idx) in nodes" :key="node.provider">
          <div
            class="failover__node"
            :class="`failover__node--${node.status}`"
          >
            <div class="failover__node-head">
              <span class="failover__dot" :class="`failover__dot--${node.status}`" />
              <strong>{{ node.label }}</strong>
              <span v-if="node.status === 'active'" class="failover__active-tag">主</span>
            </div>
            <span v-if="node.latencyMs > 0" class="failover__latency">{{ node.latencyMs }}ms</span>
            <span v-else class="failover__latency failover__latency--off">--</span>
          </div>
          <span v-if="idx < nodes.length - 1" class="failover__arrow">&rarr;</span>
        </template>
      </div>
      <p class="failover__desc">
        当主供应商不可用时，自动切换到下一个在线备用供应商，保障生成任务不中断。
      </p>
    </template>
  </div>
</template>

<style scoped>
.failover {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 18px;
}

.failover--compact {
  padding: 10px 14px;
}

.failover__compact {
  display: flex;
  align-items: center;
  gap: 8px;
}

.failover__compact-text {
  font-size: 12px;
  color: var(--text-secondary);
}

.failover__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-secondary);
}

.failover__dot--active {
  background: var(--success, #22c55e);
  box-shadow: 0 0 6px var(--success, #22c55e);
  animation: pulse 2s ease-in-out infinite;
}

.failover__dot--standby {
  background: var(--warning, #f59e0b);
}

.failover__dot--offline {
  background: var(--text-secondary);
  opacity: 0.4;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.failover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.failover__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.failover__badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  font-weight: 600;
}

.failover__chain {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.failover__node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 12px;
  transition: all 200ms;
}

.failover__node--active {
  border-color: var(--success, #22c55e);
  background: color-mix(in srgb, var(--success, #22c55e) 6%, var(--bg-primary));
}

.failover__node--offline {
  opacity: 0.5;
}

.failover__node-head {
  display: flex;
  align-items: center;
  gap: 5px;
}

.failover__node-head strong {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.failover__active-tag {
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--success, #22c55e);
  color: #fff;
  font-weight: 600;
}

.failover__latency {
  font-size: 10px;
  color: var(--text-secondary);
  font-family: monospace;
}

.failover__latency--off {
  opacity: 0.5;
}

.failover__arrow {
  color: var(--text-secondary);
  font-size: 14px;
  opacity: 0.5;
}

.failover__desc {
  margin: 12px 0 0;
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.5;
}
</style>
