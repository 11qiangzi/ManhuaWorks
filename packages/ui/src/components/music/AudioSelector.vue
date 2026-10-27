<template>
  <div class="audio-selector" :class="[`audio-selector--${size}`]" ref="rootRef">
    <!-- 触发按钮 -->
    <button
      type="button"
      class="audio-selector__trigger"
      :class="{ 'audio-selector__trigger--active': isOpen }"
      @click="toggleDropdown"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="audio-selector__trigger-icon">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
      <span v-if="selected" class="audio-selector__selected-name">{{ selected.name }}</span>
      <span v-else class="audio-selector__placeholder">{{ placeholder }}</span>
      <svg
        v-if="selected"
        class="audio-selector__clear"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        @click.stop="emit('clear')"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
      <svg
        v-else
        class="audio-selector__chevron"
        :class="{ 'audio-selector__chevron--open': isOpen }"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- 下拉面板 -->
    <Transition name="dropdown">
      <div v-if="isOpen" class="audio-selector__dropdown" @click.stop>
        <!-- 搜索栏 -->
        <div class="audio-selector__search-row">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="audio-selector__search-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            class="audio-selector__search-input"
            placeholder="搜索音频..."
            @input="onSearch"
          />
        </div>

        <!-- 推荐列表 -->
        <div v-if="recommendations.length > 0" class="audio-selector__section">
          <span class="audio-selector__section-label">AI 推荐</span>
          <div
            v-for="item in filteredRecommendations"
            :key="item.id"
            class="audio-selector__item"
            :class="{ 'audio-selector__item--selected': selected?.id === item.id }"
            @click="selectItem(item)"
          >
            <span class="audio-selector__item-name">{{ item.name }}</span>
            <span class="audio-selector__item-duration">{{ formatDuration(item.duration) }}</span>
            <div v-if="item.mood?.length" class="audio-selector__item-moods">
              <span
                v-for="m in item.mood.slice(0, 3)"
                :key="m.id"
                class="audio-selector__mood-dot"
                :style="{ backgroundColor: m.color }"
                :title="m.label"
              />
            </div>
          </div>
        </div>

        <!-- 加载更多 -->
        <div v-if="hasMore" class="audio-selector__load-more">
          <button type="button" class="audio-selector__load-more-btn" @click="emit('load-more')">
            加载更多
          </button>
        </div>

        <!-- 底部操作 -->
        <div class="audio-selector__footer">
          <button
            v-if="showAiGenerate"
            type="button"
            class="audio-selector__ai-btn"
            @click="emit('ai-generate')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="audio-selector__ai-icon">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.378 3.378 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI 生成
          </button>
          <button
            v-if="showMaterialLibrary"
            type="button"
            class="audio-selector__lib-btn"
            @click="emit('open-material-library')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="audio-selector__lib-icon">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            素材库
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import type { AudioTrackEntry, AudioFilter, ComponentSize } from './types';

interface Props {
  /** 当前选中的音频 */
  selected?: AudioTrackEntry | null;
  /** 筛选条件 */
  filters?: AudioFilter | null;
  /** AI 推荐列表 */
  recommendations?: AudioTrackEntry[];
  /** 显示 AI 生成按钮 */
  showAiGenerate?: boolean;
  /** 显示素材库按钮 */
  showMaterialLibrary?: boolean;
  /** 尺寸 */
  size?: ComponentSize;
  /** 占位文字 */
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  selected: null,
  filters: null,
  recommendations: () => [],
  showAiGenerate: true,
  showMaterialLibrary: true,
  size: 'md',
  placeholder: '选择音频...',
});

const emit = defineEmits<{
  select: [audio: AudioTrackEntry];
  clear: [];
  'ai-generate': [];
  'open-material-library': [];
  search: [query: string];
  'load-more': [];
}>();

const rootRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const isOpen = ref(false);
const searchQuery = ref('');
const hasMore = ref(false);

const filteredRecommendations = computed(() => {
  if (!searchQuery.value) return props.recommendations;
  const q = searchQuery.value.toLowerCase();
  return props.recommendations.filter(
    (r) => r.name.toLowerCase().includes(q) || r.mood?.some((m) => m.label.includes(q))
  );
});

function toggleDropdown() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    nextTick(() => searchInputRef.value?.focus());
  }
}

function selectItem(item: AudioTrackEntry) {
  emit('select', item);
  isOpen.value = false;
  searchQuery.value = '';
}

function onSearch() {
  emit('search', searchQuery.value);
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function onClickOutside(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => document.addEventListener('click', onClickOutside));
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside));
</script>

<style scoped>
.audio-selector {
  position: relative;
  display: inline-block;
  font-family: inherit;
}

.audio-selector--sm { font-size: 13px; }
.audio-selector--md { font-size: 14px; }
.audio-selector--lg { font-size: 15px; }

.audio-selector__trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 200px;
  padding: 8px 12px;
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.12));
  border-radius: 8px;
  background: var(--color-bg-secondary, rgba(255, 255, 255, 0.05));
  color: var(--color-text, #e5e7eb);
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.audio-selector__trigger:hover,
.audio-selector__trigger--active {
  border-color: rgba(0, 191, 165, 0.4);
}

.audio-selector__trigger--active {
  box-shadow: 0 0 0 2px rgba(0, 191, 165, 0.15);
}

.audio-selector__trigger-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: #00BFA5;
}

.audio-selector__selected-name {
  flex: 1;
  text-align: left;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.audio-selector__placeholder {
  flex: 1;
  text-align: left;
  color: var(--color-text-secondary, #9ca3af);
}

.audio-selector__clear {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--color-text-secondary, #9ca3af);
  cursor: pointer;
  transition: color 0.2s;
}
.audio-selector__clear:hover { color: #EF4444; }

.audio-selector__chevron {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--color-text-secondary, #9ca3af);
  transition: transform 0.2s;
}
.audio-selector__chevron--open { transform: rotate(180deg); }

/* 下拉面板 */
.audio-selector__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  min-width: 280px;
  max-height: 360px;
  overflow-y: auto;
  z-index: 50;
  background: var(--color-bg, #1a1a2e);
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.12));
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  padding: 8px;
}

.audio-selector__search-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  margin-bottom: 6px;
}

.audio-selector__search-icon {
  width: 16px;
  height: 16px;
  color: var(--color-text-secondary, #9ca3af);
  flex-shrink: 0;
}

.audio-selector__search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--color-text, #e5e7eb);
  font-size: 13px;
  outline: none;
}

.audio-selector__search-input::placeholder {
  color: var(--color-text-secondary, #6b7280);
}

.audio-selector__section { padding: 4px 0; }

.audio-selector__section-label {
  display: block;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  color: #7C3AED;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.audio-selector__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.audio-selector__item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.audio-selector__item--selected {
  background: rgba(0, 191, 165, 0.1);
  border-left: 2px solid #00BFA5;
}

.audio-selector__item-name {
  flex: 1;
  font-size: 13px;
  color: var(--color-text, #e5e7eb);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.audio-selector__item-duration {
  font-size: 11px;
  color: var(--color-text-secondary, #9ca3af);
  font-variant-numeric: tabular-nums;
}

.audio-selector__item-moods {
  display: flex;
  gap: 3px;
}

.audio-selector__mood-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.audio-selector__load-more {
  text-align: center;
  padding: 6px;
}

.audio-selector__load-more-btn {
  padding: 4px 16px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-secondary, #9ca3af);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.audio-selector__load-more-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* 底部操作 */
.audio-selector__footer {
  display: flex;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin-top: 4px;
}

.audio-selector__ai-btn,
.audio-selector__lib-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  justify-content: center;
  padding: 7px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.audio-selector__ai-btn {
  background: linear-gradient(135deg, #00BFA5, #7C3AED);
  color: #fff;
}

.audio-selector__ai-btn:hover {
  box-shadow: 0 2px 8px rgba(0, 191, 165, 0.3);
}

.audio-selector__ai-icon {
  width: 14px;
  height: 14px;
}

.audio-selector__lib-btn {
  background: rgba(124, 58, 237, 0.12);
  color: #A78BFA;
  border: 1px solid rgba(124, 58, 237, 0.2);
}

.audio-selector__lib-btn:hover {
  background: rgba(124, 58, 237, 0.2);
}

.audio-selector__lib-icon {
  width: 14px;
  height: 14px;
}

/* 过渡动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
