<script setup lang="ts">
/**
 * HomeView.vue — 创作者工作台首页
 * 林染 🔮 2026-06-10: V2 改版
 *   新增：创作链路引导 / 模式选择 / 更新公告 / 素材案例
 *   对标：阅文动画助手首页全链路设计
 */
import { RouterLink } from 'vue-router'
import { useRouter } from 'vue-router'
import { ref, onMounted } from 'vue'
import { useProjectStore } from '../stores/project'
import { useAuthStore } from '../stores/auth'
import { useToast } from '@manhuaworks/ui'

const projectStore = useProjectStore()
const authStore = useAuthStore()
const toast = useToast()
const router = useRouter()

const userEmail = ref('')
const projectCount = ref(0)
const stats = ref({ shots: 0 })
const loading = ref(true)

onMounted(async () => {
  loading.value = true
  try {
    userEmail.value = authStore.user?.email ?? ''
    await projectStore.loadList()
    projectCount.value = projectStore.total
    stats.value.shots = projectStore.projects.reduce((sum, p) => sum + (p.shot_count ?? 0), 0)
  } catch (e) {
    toast.error('加载项目数据失败，请稍后重试')
  } finally {
    loading.value = false
  }
})

// ============ 🆕 创作模式 (mockup 1:1) ============
const activeAutoStyle = ref('premium')
const creationModes = [
  {
    id: 'auto',
    title: '自动流程',
    icon: '🚀',
    desc: '我们预配好的小说 → 动画流水线，上传小说后跟着步骤走，AI 自动完成角色提取、镜头生成、视频合片。适合快速出片。',
    badges: ['推荐', '零门槛', '一键出片'],
    to: '/project',
    active: true,
    subOptions: [
      { id: 'premium', name: '精品动画', icon: '🎨', desc: '高画质角色' },
      { id: 'commentary', name: '解说动画', icon: '🎙️', desc: '故事驱动型' },
      { id: 'liveaction', name: '真人剧', icon: '🎬', desc: '写实风格' },
    ],
  },
  {
    id: 'pro',
    title: '自主配置',
    icon: '🔧',
    desc: '打开工作流设计器，自己拖拽节点搭建管线。自定义每一步的模型、参数、Prompt。适合对质量有要求、有 AI 经验的创作者。',
    badges: ['进阶', '完全可控', '支持 BYOK'],
    to: '/workflow',
    active: false,
    capabilities: ['🤖 每步选模型', '📝 Prompt 调优', '🔗 节点编排', '⚙ 参数细调', '🔄 条件分支', '📊 批量生成'],
  },
]

// ============ 🆕 创作链路 ============
const pipelineSteps = [
  { step: 1, title: '故事', sub: '小说/剧本', icon: '📖', desc: '选择小说章节或上传剧本，AI 智能生成剧本', to: '/project' },
  { step: 2, title: '素材', sub: '角色+场景', icon: '🎭', desc: '智能提取角色/场景，管理主视觉图和设定集', to: '/characters' },
  { step: 3, title: '镜头', sub: '镜头生成', icon: '🎞️', desc: '智能导演模式生成镜头，宫格/多机位可选', to: '/project' },
  { step: 4, title: '视频', sub: '视频生成', icon: '🎥', desc: '多模型视频生成，音画同步，首尾帧控制', to: '/workflow' },
  { step: 5, title: '配乐', sub: '配乐设定', icon: '🎵', desc: 'AI 智能配乐，情绪时间线+BGM/SFX/旁白三轨混音', to: '/project' },
  { step: 6, title: '后期', sub: '工具处理', icon: '🔧', desc: '智能剪辑/视频高清/运镜/字幕去除/图片扩展', to: '/tools' },
  { step: 7, title: '导出', sub: '成品输出', icon: '📤', desc: '预览成片，多格式导出，一键下载', to: '/export' },
]

// ============ 🆕 更新公告 ============
const announcements = [
  { date: '2026-06-09', tag: '新功能', text: '首页全新改版，创作链路一目了然' },
  { date: '2026-06-05', tag: '新模型', text: '工作流新增 novel-to-drama 剧本生成节点' },
  { date: '2026-06-01', tag: '优化', text: '角色管理接入真 API，支持团队协作' },
]

// ============ 🆕 素材案例 ============
const demos = [
  { title: '逆袭的A班少女', style: '校园', duration: '00:12', color: '#f472b6' },
  { title: '鲲鹏', style: '玄幻', duration: '00:16', color: '#60a5fa' },
  { title: '我的代码恋人', style: '都市', duration: '00:10', color: '#34d399' },
  { title: '天道刃', style: '武侠', duration: '00:10', color: '#fbbf24' },
  { title: '觉醒时刻', style: '异能', duration: '00:20', color: '#a78bfa' },
  { title: '开局拒入宫斗剧本', style: '古装', duration: '00:28', color: '#f87171' },
]

function onDemoClick(demo: typeof demos[number]) {
  router.push({ path: '/materials', query: { title: demo.title } })
}
</script>

<template>
  <div class="home">
    <!-- ========== 🔥 Hero Banner ========== -->
    <div class="home-hero">
      <div class="home-hero-left">
        <h1 class="home-hero-title">
          {{ userEmail ? `欢迎回来，${userEmail.split('@')[0]}` : '欢迎使用千机工坊' }}
        </h1>
        <p class="home-hero-desc">
          AI 驱动的动画创作平台 — 从小说到成片，一站式全链路创作
        </p>
        <div class="home-hero-actions">
          <RouterLink to="/project/new" class="home-hero-cta">
            🚀 开始创作
          </RouterLink>
          <RouterLink to="/project" class="home-hero-secondary">
            查看项目列表 →
          </RouterLink>
        </div>
        <div class="home-hero-stats">
          <template v-if="loading">
            <span class="home-hero-stat home-hero-stat--loading">加载数据中...</span>
          </template>
          <template v-else>
            <span class="home-hero-stat">{{ projectCount }} 个项目</span>
            <span class="home-hero-stat">{{ stats.shots }} 个镜头</span>
          </template>
        </div>
      </div>
      <div class="home-hero-right">
        <div class="home-hero-orb home-hero-orb-1"></div>
        <div class="home-hero-orb home-hero-orb-2"></div>
        <div class="home-hero-orb home-hero-orb-3"></div>
        <div class="home-hero-icon">🎨</div>
      </div>
    </div>

    <!-- ========== 🆕 创作方式选择 (mockup 1:1) ========== -->
    <div class="home-section">
      <h2 class="home-section-title">🎯 选择创作方式</h2>
      <div class="home-mode-choice">
        <div
          v-for="mode in creationModes"
          :key="mode.id"
          class="home-choice-card"
          :class="[mode.id, { active: mode.active }]"
        >
          <div class="home-choice-icon" :class="`home-choice-icon--${mode.id}`">{{ mode.icon }}</div>
          <div class="home-choice-body">
            <div class="home-choice-name">{{ mode.title }}</div>
            <div class="home-choice-desc">{{ mode.desc }}</div>
            <div class="home-choice-badges">
              <span v-for="b in mode.badges" :key="b" class="badge" :class="{'badge--green':b==='推荐','badge--blue':b==='零门槛','badge--purple':b==='一键出片'||b==='支持 BYOK','badge--amber':b==='进阶','badge--red':b==='完全可控'}">{{ b }}</span>
            </div>
            <div v-if="mode.id==='auto'" class="home-choice-sub">
              <div class="home-choice-sub-label">选择输出风格</div>
              <div class="home-choice-sub-options">
                <div v-for="opt in mode.subOptions" :key="opt.id" class="home-sub-opt" :class="{active:activeAutoStyle===opt.id}" @click="activeAutoStyle=opt.id">
                  <span class="home-sub-opt-icon">{{ opt.icon }}</span>
                  <span class="home-sub-opt-name">{{ opt.name }}</span>
                  <div class="home-sub-opt-desc">{{ opt.desc }}</div>
                </div>
              </div>
            </div>
            <div v-if="mode.id==='pro'" class="home-choice-sub">
              <div class="home-choice-sub-label">你可以自定义</div>
              <div class="home-pro-capabilities">
                <span v-for="c in mode.capabilities" :key="c" class="home-pro-chip">{{ c }}</span>
              </div>
            </div>
          </div>
          <RouterLink
            :to="mode.to"
            class="home-choice-cta"
          >
            {{ mode.id==='auto'?'开始创作 →':'打开工作流 →' }}
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- ========== 🆕 创作全链路 ========== -->
    <div class="home-section">
      <h2 class="home-section-title">📋 创作全链路</h2>
      <p class="home-section-desc">从小说到成品视频，七步完成创作</p>
      <div class="home-pipeline">
        <RouterLink
          v-for="step in pipelineSteps"
          :key="step.step"
          :to="step.to"
          class="home-pipeline-step"
        >
          <div class="home-pipeline-num">{{ step.step }}</div>
          <div class="home-pipeline-title">{{ step.icon }} {{ step.title }}</div>
          <div class="home-pipeline-sub">{{ step.sub }}</div>
          <div class="home-pipeline-desc">{{ step.desc }}</div>
        </RouterLink>
      </div>
    </div>

    <!-- ========== 双栏：更新公告 + 素材案例 ========== -->
    <div class="home-grid">
      <!-- 更新公告 -->
      <div class="home-section home-section--half">
        <h2 class="home-section-title">📢 更新公告</h2>
        <div class="home-announcements">
          <div v-for="a in announcements" :key="a.date" class="home-announce-item">
            <span class="home-announce-tag" :class="`home-announce-tag--${a.tag}`">{{ a.tag }}</span>
            <span class="home-announce-text">{{ a.text }}</span>
            <span class="home-announce-date">{{ a.date.slice(5) }}</span>
          </div>
          <RouterLink to="/project" class="home-announce-more">
            查看全部更新 →
          </RouterLink>
        </div>
      </div>

      <!-- 素材案例 -->
      <div class="home-section home-section--half">
        <h2 class="home-section-title">🎬 素材案例</h2>
        <div class="home-demos">
          <div v-for="d in demos" :key="d.title" class="home-demo-card" @click="onDemoClick(d)">
            <div class="home-demo-thumb" :style="{ background: d.color }">
              <span class="home-demo-play">▶</span>
              <span class="home-demo-duration">{{ d.duration }}</span>
            </div>
            <div class="home-demo-info">
              <span class="home-demo-title">{{ d.title }}</span>
              <span class="home-demo-style">{{ d.style }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== 新手指南 ========== -->
    <div class="home-section">
      <h2 class="home-section-title">💡 新手指南</h2>
      <div class="home-steps">
        <div class="home-step">
          <span class="home-step-num">1</span>
          <div class="home-step-content">
            <h4 class="home-step-title">新建项目</h4>
            <p class="home-step-desc">从首页选择创作模式，创建你的动画项目</p>
          </div>
        </div>
        <div class="home-step">
          <span class="home-step-num">2</span>
          <div class="home-step-content">
            <h4 class="home-step-title">准备素材</h4>
            <p class="home-step-desc">设置角色主视觉图、场景设定和道具</p>
          </div>
        </div>
        <div class="home-step">
          <span class="home-step-num">3</span>
          <div class="home-step-content">
            <h4 class="home-step-title">生成镜头</h4>
            <p class="home-step-desc">AI 智能镜头，选择风格和机位</p>
          </div>
        </div>
        <div class="home-step">
          <span class="home-step-num">4</span>
          <div class="home-step-content">
            <h4 class="home-step-title">导出成品</h4>
            <p class="home-step-desc">预览成片效果，一键导出视频</p>
          </div>
        </div>
      </div>
    </div>

    <div class="home-footer">
      <span>千机工坊 - AI 动画创作平台</span>
    </div>
  </div>
</template>

<style scoped>
.home {
  padding: 32px 40px;
  max-width: 1200px;
  margin: 0 auto;
  animation: homeFadeIn 0.4s ease;
}

@keyframes homeFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ===== Hero ===== */
.home-hero {
  display: flex;
  align-items: center;
  gap: 48px;
  padding: 40px 40px;
  margin-bottom: 36px;
  background: linear-gradient(135deg, rgba(102,126,234,0.06) 0%, rgba(118,75,162,0.06) 100%);
  border: 1px solid var(--border, #1f2937);
  border-radius: 16px;
  position: relative;
  overflow: hidden;
}
.home-hero-left { flex: 1; z-index: 1; }
.home-hero-title { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: var(--text-primary, #f0f0f0); margin-bottom: 10px; }
.home-hero-desc { font-size: 14px; color: var(--text-secondary, #94a3b8); margin-bottom: 20px; max-width: 480px; }
.home-hero-actions { display: flex; gap: 10px; }
.home-hero-cta {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 11px 22px; border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white; font-size: 14px; font-weight: 600;
  text-decoration: none; transition: all 200ms;
}
.home-hero-cta:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(102,126,234,0.3); }
.home-hero-secondary {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 11px 18px; border-radius: 10px;
  background: var(--bg-tertiary, #1f2937); color: var(--text-secondary, #94a3b8);
  font-size: 13px; text-decoration: none; border: 1px solid var(--border, #1f2937);
  transition: all 200ms;
}
.home-hero-secondary:hover { color: var(--text-primary, #e4e4e7); border-color: var(--accent, #818cf8); }
.home-hero-stats { display: flex; gap: 16px; margin-top: 14px; font-size: 12px; color: var(--text-secondary, #94a3b8); }
.home-hero-stat--loading { opacity: 0.5; animation: homeStatsPulse 1.5s ease-in-out infinite; }
@keyframes homeStatsPulse { 0%,100%{opacity:.3} 50%{opacity:.7} }
.home-hero-right { width: 180px; height: 140px; flex-shrink: 0; position: relative; }
.home-hero-orb { position: absolute; border-radius: 50%; filter: blur(40px); opacity: 0.3; }
.home-hero-orb-1 { width: 90px; height: 90px; background: #667eea; top: 10px; left: 30px; animation: orb1 6s ease-in-out infinite; }
.home-hero-orb-2 { width: 70px; height: 70px; background: #764ba2; top: 50px; left: 70px; animation: orb2 8s ease-in-out infinite; }
.home-hero-orb-3 { width: 55px; height: 55px; background: #34d399; top: 15px; right: 15px; animation: orb3 7s ease-in-out infinite; }
.home-hero-icon { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-size: 42px; z-index: 2; }
@keyframes orb1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(12px,-8px)} }
@keyframes orb2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-8px,8px)} }
@keyframes orb3 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(6px,-4px)} }

/* ===== Section ===== */
.home-section { margin-bottom: 32px; }
.home-section--half { flex: 1; min-width: 0; }
.home-section-title { font-size: 15px; font-weight: 700; color: var(--text-primary, #e4e4e7); margin-bottom: 12px; }
.home-section-desc { font-size: 12px; color: var(--text-secondary, #94a3b8); margin: -8px 0 12px; }

/* ===== 🆕 创作方式选择 (mockup 1:1) ===== */
.home-mode-choice { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
.home-choice-card {
  position: relative; display: flex; flex-direction: column;
  padding: 28px 24px; border-radius: var(--radius-lg, 16px);
  border: 2px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  cursor: pointer; transition: all .25s;
}
.home-choice-card:hover { border-color: var(--border-strong, #374151); transform: translateY(-2px); }
.home-choice-card.auto { background: linear-gradient(135deg,rgba(102,126,234,.06),rgba(118,75,162,.04)); }
.home-choice-card.auto:hover, .home-choice-card.auto.active { border-color: var(--accent, #818cf8); }
.home-choice-card.pro { background: linear-gradient(135deg,rgba(245,158,11,.06),rgba(217,119,6,.04)); }
.home-choice-card.pro:hover, .home-choice-card.pro.active { border-color: #f59e0b; }
.home-choice-icon {
  width: 56px; height: 56px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; flex-shrink: 0; margin-bottom: 16px;
}
.home-choice-icon--auto { background: linear-gradient(135deg,#667eea,#764ba2); color: #fff; }
.home-choice-icon--pro { background: linear-gradient(135deg,#f59e0b,#d97706); color: #fff; }
.home-choice-body { flex: 1; }
.home-choice-name { font-size: 18px; font-weight: 700; margin-bottom: 4px; color: var(--text-primary, #e4e4e7); }
.home-choice-desc { font-size: 12px; color: var(--text-secondary, #94a3b8); line-height: 1.6; margin-bottom: 10px; }
.home-choice-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.home-choice-sub { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border, #1f2937); }
.home-choice-sub-label {
  font-size: 10px; color: var(--text-muted, #64748b);
  text-transform: uppercase; letter-spacing: .05em; margin-bottom: 8px;
}
.home-choice-sub-options { display: flex; gap: 8px; }
.home-sub-opt {
  flex: 1; padding: 12px; border-radius: 8px;
  background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1f2937);
  cursor: pointer; text-align: center; font-size: 12px; transition: all .15s;
}
.home-sub-opt:hover { border-color: var(--accent, #818cf8); }
.home-sub-opt.active { border-color: var(--accent, #818cf8); background: rgba(99,102,241,.08); }
.home-sub-opt-icon { font-size: 20px; display: block; margin-bottom: 4px; }
.home-sub-opt-name { font-weight: 600; color: var(--text-primary, #e4e4e7); }
.home-sub-opt-desc { font-size: 10px; color: var(--text-muted, #64748b); margin-top: 2px; }
.home-pro-capabilities { display: flex; gap: 8px; flex-wrap: wrap; }
.home-pro-chip {
  padding: 4px 10px; border-radius: 12px; font-size: 11px;
  background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1f2937);
  color: var(--text-secondary, #94a3b8);
}
.home-choice-cta {
  display: inline-flex; align-items: center; gap: 6px; margin-top: 16px;
  padding: 10px 20px; border-radius: 10px; font-size: 14px; font-weight: 600;
  text-decoration: none; transition: all .2s; align-self: flex-start;
}
.home-choice-card.auto .home-choice-cta {
  background: linear-gradient(135deg,#667eea,#764ba2); color: #fff;
}
.home-choice-card.auto .home-choice-cta:hover { box-shadow: 0 4px 16px rgba(102,126,234,.3); }
.home-choice-card.pro .home-choice-cta {
  background: linear-gradient(135deg,#f59e0b,#d97706); color: #fff;
}
.home-choice-card.pro .home-choice-cta:hover { box-shadow: 0 4px 16px rgba(245,158,11,.3); }

/* ===== 🆕 创作链路 ===== */
.home-pipeline { display: flex; gap: 0; border-radius: 12px; overflow: hidden; border: 1px solid var(--border, #1f2937); }
/* ===== Pipeline (1:1 match studio-home.html) ===== */
.home-pipeline {
  display: flex; border: 1px solid var(--border, #1f2937);
  border-radius: var(--radius, 12px); overflow: hidden;
}
.home-pipeline-step {
  flex: 1; padding: 16px 14px; background: var(--bg-card, #141a2e);
  border-right: 1px solid var(--border, #1f2937);
  text-decoration: none; color: inherit; transition: all .2s;
}
.home-pipeline-step:last-child { border-right: none; }
.home-pipeline-step:hover { background: var(--bg-tertiary, #1a2332); }
.home-pipeline-num {
  width: 26px; height: 26px; border-radius: 50%;
  background: rgba(99,102,241,.15); color: var(--accent, #818cf8);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; margin-bottom: 6px;
}
.home-pipeline-title { font-size: 13px; font-weight: 700; color: var(--text-primary, #e4e4e7); }
.home-pipeline-sub { font-size: 10px; color: var(--text-muted, #64748b); }
.home-pipeline-desc { font-size: 10px; color: var(--text-muted, #64748b); margin-top: 2px; }

/* ===== Grid 双栏 ===== */
.home-grid { display: flex; gap: 20px; margin-bottom: 32px; }

/* ===== 🆕 更新公告 ===== */
.home-announcements { display: flex; flex-direction: column; gap: 0; border: 1px solid var(--border, #1f2937); border-radius: 10px; overflow: hidden; }
.home-announce-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-bottom: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827); font-size: 12px;
}
.home-announce-item:last-child { border-bottom: none; }
.home-announce-tag {
  padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; flex-shrink: 0;
}
.home-announce-tag--新功能 { background: rgba(52,211,153,0.12); color: #34d399; }
.home-announce-tag--新模型 { background: rgba(129,140,248,0.12); color: #818cf8; }
.home-announce-tag--优化 { background: rgba(251,191,36,0.12); color: #fbbf24; }
.home-announce-text { flex: 1; color: var(--text-primary, #e4e4e7); }
.home-announce-date { font-size: 10px; color: var(--text-secondary, #94a3b8); flex-shrink: 0; }
.home-announce-more { display: block; padding: 10px 14px; background: var(--bg-secondary, #111827); font-size: 11px; color: var(--accent, #818cf8); cursor: pointer; text-align: center; text-decoration: none; }
.home-announce-more:hover { background: var(--bg-tertiary, #1f2937); }

/* ===== 🆕 素材案例 ===== */
.home-demos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.home-demo-card { border: 1px solid var(--border, #1f2937); border-radius: 10px; overflow: hidden; background: var(--bg-secondary, #111827); transition: all 200ms; cursor: pointer; }
.home-demo-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }
.home-demo-thumb {
  height: 60px; display: flex; align-items: center; justify-content: center;
  position: relative; opacity: 0.8;
}
.home-demo-play { font-size: 20px; color: white; text-shadow: 0 2px 8px rgba(0,0,0,0.5); }
.home-demo-duration { position: absolute; bottom: 4px; right: 6px; font-size: 9px; color: white; background: rgba(0,0,0,0.5); padding: 1px 4px; border-radius: 3px; }
.home-demo-info { padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
.home-demo-info .home-demo-title { font-size: 11px; font-weight: 600; color: var(--text-primary, #e4e4e7); }
.home-demo-info .home-demo-style { font-size: 10px; color: var(--text-secondary, #94a3b8); }

/* ===== 新手指南 ===== */
.home-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.home-step { display: flex; gap: 12px; padding: 16px; background: var(--bg-secondary, #111827); border: 1px solid var(--border, #1f2937); border-radius: 10px; transition: all 200ms; }
.home-step:hover { border-color: var(--accent, #818cf8); }
.home-step-num { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg,rgba(102,126,234,0.15),rgba(118,75,162,0.15)); color: var(--accent,#818cf8); font-weight: 700; font-size: 13px; flex-shrink: 0; }
.home-step-content { flex: 1; }
.home-step-title { font-size: 13px; font-weight: 700; color: var(--text-primary,#e4e4e7); margin: 0 0 3px; }
.home-step-desc { font-size: 11px; color: var(--text-secondary,#94a3b8); margin: 0; }

/* ===== Footer ===== */
.home-footer { text-align: center; padding: 20px 0 0; border-top: 1px solid var(--border, #1f2937); }
.home-footer span { font-size: 11px; color: var(--text-secondary, #94a3b8); opacity: 0.5; }

/* ===== Responsive ===== */
@media (max-width: 1000px) {
  .home { padding: 20px; }
  .home-mode-choice { grid-template-columns: 1fr; }
  .home-pipeline { flex-wrap: wrap; }
  .home-pipeline-step { flex: 1 1 33%; border-bottom: 1px solid var(--border, #1f2937); }
  .home-grid { flex-direction: column; }
}

@media (max-width: 640px) {
  .home-hero { flex-direction: column; text-align: center; padding: 24px; }
  .home-hero-actions { justify-content: center; }
  .home-hero-right { width: 100px; height: 80px; }
  .home-pipeline-step { flex: 1 1 50%; }
  .home-steps { grid-template-columns: 1fr 1fr; }
  .home-demos { grid-template-columns: repeat(2, 1fr); }
}
</style>
