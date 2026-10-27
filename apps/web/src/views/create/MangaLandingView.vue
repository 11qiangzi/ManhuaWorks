<script setup lang="ts">
/*
 * MangaLandingView.vue - 动画生成器着陆页
 * P2 重构版本, 2026-06-21
 *   - 包含 StoryboardEditorView 的 mock 数据 + 6 种画风预设
 *   - 零操作工作流: AI 一键生成分镜 + 7 种预设故事模板
 * P2 重构版本, 2026-06-21
 *   - 包含 StoryboardEditorView 的 mock 数据 + 7 种画风预设
 */





import { ref, computed } from 'vue'


import { useRouter } from 'vue-router'





const router = useRouter()





/* ================================================================== */


/*  集数配置区域                                                        */


/* ================================================================== */





interface StylePreset {


  key: string


  label: string


  description: string


  color: string


}





const STYLE_PRESETS: StylePreset[] = [


  { key: 'anime-realistic', label: '日系写实', description: '日本动画风格, 细腻光影', color: '#7DD3FC' },


  { key: 'anime-classic', label: '经典动漫', description: '90年代动漫风, 手绘质感', color: '#F472B6' },


  { key: 'chinese-ink', label: '国风水墨', description: '中国水墨画风格, 写意渲染', color: '#A78BFA' },


  { key: 'comic-graphic', label: '美漫 Graphic', description: '欧美漫画/DC 风格, 粗犷线条', color: '#FB923C' },


  { key: '3d-cinematic', label: '3D 影视级', description: '像素级渲染, 电影光影效果', color: '#34D399' },


  { key: 'sketch-line', label: '素描线稿', description: '简约线条风格, 手绘质感', color: '#FBBF24' },


]





const selectedStyle = ref<StylePreset>(STYLE_PRESETS[0])





/* ================================================================== */


/* 自定义风格                                                           */


/* ================================================================== */





interface AspectOption {


  key: string


  label: string


  icon: string


  description: string


}





const ASPECT_OPTIONS: AspectOption[] = [


  { key: '16:9', label: '横屏 16:9', icon: '▶', description: '电影/电视宽屏比例' },


  { key: '9:16', label: '竖屏 9:16', icon: '▶', description: '竖屏短视频/手机全屏' },


]





const selectedAspect = ref<AspectOption>(ASPECT_OPTIONS[0])





/* ================================================================== */


/*  闂傚棗妫欓弳鐔兼焻婢跺��锟姐劑宕�?                                                        */


/* ================================================================== */





const episodeCount = ref(3)


const EPISODE_RANGE = [1, 2, 3, 4, 5, 6]





/* ================================================================== */


/*  一键工作流配置区域                                                       */


/* ================================================================== */





const SAMPLE_WORKS = [


  {


    title: '都市奇幻夜行者',


    description: '濞戞搫鎷烽柛锕傜細濞夋洜鎼炬繝鍐┬曟繛鎾�锟藉孩鐣遍柡鍌氭处濡叉垿宕ｉ懠鍓佹Щ',


    style: '水墨宣纸古风漫改',


    thumbnail: '',


  },


  {


    title: '星际远征动画',


    description: '宇宙飞船穿越星系, 科幻史诗级场景',


    style: '3D 科幻写实风格',


    thumbnail: '',


  },


  {


    title: '江湖剑影录',


    description: '武侠世界, 剑影纷飞, 江湖恩怨',


    style: '缂備礁绻愰崥锟介柡鍐﹀劜閺嬶拷',


    thumbnail: '',


  },


]





const currentSample = ref(0)





function nextSample() {


  currentSample.value = (currentSample.value + 1) % SAMPLE_WORKS.length


}





function prevSample() {


  currentSample.value = (currentSample.value - 1 + SAMPLE_WORKS.length) % SAMPLE_WORKS.length


}





/* ================================================================== */


/*  7 种预设故事模板: 用户可选择快速开始创作                                        */


/* ================================================================== */





const FLOW_STEPS = [


  { icon: '🤖', title: '一键AI生成', desc: '输入小说文本, AI自动拆解分镜并生成动画序列' },


  { icon: '🎬', title: 'AI 智能分镜', desc: 'AI 自动分析剧情结构, 生成多种分镜方案' },


  { icon: '🎨', title: '多风格选择', desc: '支持 CRAFT 方法论: 环境/参考/动作/运镜/时间 五维度' },


  { icon: '📦', title: '一键导出', desc: '支持多种格式导出/多平台适配/高清视频' },


  { icon: '🔄', title: '智能连贯模式', desc: 'AI 自动匹配连贯风格, 确保角色一致性' },


  { icon: '📥', title: '预设模板库', desc: 'AI 一键生成 + 预设模板 + 自定义配置' },


  { icon: '📥', title: '多预览方案', desc: 'AI 生成多种方案 + 用户选择 + 保存预览' },


]





/* ================================================================== */


/*  閻庝絻澹堥崺锟�                                                               */


/* ================================================================== */





const canProceed = computed(() => selectedStyle.value !== null)





function startCreation() {


  // 将配置存入 sessionStorage, 跳转到 StoryboardEditorView 并插入数据


  sessionStorage.setItem('mhw:landing-config', JSON.stringify({


    style: selectedStyle.value.key,


    aspectRatio: selectedAspect.value.key,


    episodeCount: episodeCount.value,


  }))


  router.push('/create/animation')


}





function goToProMode() {


  router.push('/create/animation')


}


</script>





<template>


  <div class="landing">


    <!-- ===== Hero ===== -->


    <section class="hero">


      <div class="hero__content">


        <h1 class="hero__title">


          粘贴你的小说文本，AI自动拆解分镜并生成动画          <span class="hero__title-accent">动画生成器</span>


        </h1>


        <p class="hero__subtitle">


          输入小说文本, AI自动拆解分镜并生成动画序列。支持多种风格预设和AI一键生成。


        </p>


        <button class="hero__cta" @click="startCreation">


          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">


            <path d="M2 10L8 4l1.4 1.4L5.8 9H18v2H5.8l3.6 3.6L8 16l-6-6z" fill="currentColor" />


            <path d="M6 10l4 4-1.4 1.4L2 12" fill="currentColor" opacity="0" />


          </svg>


          <span>缂佹柨锟斤拷瀹撳棝宕氬☉妤冪▕</span>


          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="hero__cta-arrow">


            <path d="M2 12l1.4 1.4L7 9.8V22h2V9.8l3.6 3.6L14 12l-6-6-6 6z" stroke="currentColor" stroke-width="1.5" />


          </svg>


        </button>





        <!-- 闂佹澘绉堕悿鍡涙�冮姀鈩冪凡 -->


        <div class="hero__config">


          <!-- 集数配置区域 -->


          <div class="config-group">


            <label class="config-label">集数配置区域</label>


            <div class="style-grid">


              <button


                v-for="style in STYLE_PRESETS"


                :key="style.key"


                class="style-chip"


                :class="{ 'style-chip--active': selectedStyle.key === style.key }"


                :style="{ '--chip-color': style.color }"


                @click="selectedStyle = style"


              >


                <span class="style-chip__dot" :style="{ background: style.color }" />


                <span class="style-chip__label">{{ style.label }}</span>


                <span class="style-chip__desc">{{ style.description }}</span>


              </button>


            </div>


          </div>





          <!-- 风格选择 + 画风预设 -->


          <div class="hero__options">


            <div class="config-group">


              <label class="config-label">自定义</label>


              <div class="aspect-selector">


                <button


                  v-for="opt in ASPECT_OPTIONS"


                  :key="opt.key"


                  class="aspect-btn"


                  :class="{ 'aspect-btn--active': selectedAspect.key === opt.key }"


                  @click="selectedAspect = opt"


                >


                  <span class="aspect-btn__icon">{{ opt.icon }}</span>


                  <span class="aspect-btn__label">{{ opt.label }}</span>


                  <span class="aspect-btn__desc">{{ opt.description }}</span>


                </button>


              </div>


            </div>





            <div class="config-group">


              <label class="config-label">风格选择区域</label>


              <div class="episode-selector">


                <button


                  v-for="n in EPISODE_RANGE"


                  :key="n"


                  class="episode-btn"


                  :class="{ 'episode-btn--active': episodeCount === n }"


                  @click="episodeCount = n"


                >


                  {{ n }}闂傦拷?                </button>


              </div>


            </div>


          </div>


        </div>


      </div>


    </section>





    <!-- ===== 一键工作流配置区域 ===== -->


    <section class="showcase">


      <h2 class="section-title">缂侊拷鏉炴壆浼愬ù锝嗙矊閹硷拷</h2>


      <div class="carousel">


        <button class="carousel__btn carousel__btn--prev" @click="prevSample">


          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">


            <path d="M12 4l-6 6 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />


          </svg>


        </button>





        <div class="carousel__track">


          <div class="carousel__card">


            <div class="carousel__preview">


              <div class="carousel__placeholder">


                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">


                  <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" stroke-width="1.5" />


                  <path d="M16 24l4 4 8-8 6 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />


                  <circle cx="34" cy="18" r="2" fill="currentColor" />


                </svg>


              </div>


            </div>


            <div class="carousel__info">


              <h3 class="carousel__title">{{ SAMPLE_WORKS[currentSample].title }}</h3>


              <p class="carousel__desc">{{ SAMPLE_WORKS[currentSample].description }}</p>


              <span class="carousel__tag">{{ SAMPLE_WORKS[currentSample].style }}</span>


            </div>


          </div>


        </div>





        <button class="carousel__btn carousel__btn--next" @click="nextSample">


          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">


            <path d="M8 4l6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />


          </svg>


        </button>


      </div>





      <div class="carousel__dots">


        <button


          v-for="(_, i) in SAMPLE_WORKS"


          :key="i"


          class="carousel__dot"


          :class="{ 'carousel__dot--active': i === currentSample }"


          @click="currentSample = i"


        />


      </div>


    </section>





    <!-- ===== 7 种预设故事模板: 用户可选择快速开始创作 ===== -->


    <section class="flow">


      <h2 class="section-title">示例模板</h2>


      <p class="section-desc">选择一个故事模板快速开始, AI 会自动生成分镜和动画序列。支持 7 种预设模板。</p>





      <div class="flow__steps">


        <div


          v-for="(step, i) in FLOW_STEPS"


          :key="i"


          class="flow-step"


        >


          <div class="flow-step__number">


            <span class="flow-step__icon">{{ step.icon }}</span>


            <span class="flow-step__index">{{ i + 1 }}</span>


          </div>


          <div class="flow-step__content">


            <h3 class="flow-step__title">{{ step.title }}</h3>


            <p class="flow-step__desc">{{ step.desc }}</p>


          </div>


          <div v-if="i < FLOW_STEPS.length - 1" class="flow-step__connector" />


        </div>


      </div>


    </section>





    <!-- ===== Footer ===== -->


    <footer class="footer">


      <div class="footer__content">


        <p class="footer__text">


          闂傚浄鎷烽悷鏇氱劍濞茶法鍒掗崜褏鐭庨柣銊ュ��鐢�鍫曞礆鐠佸湱鍚�


          <a class="footer__link" @click.prevent="goToProMode">


            粘贴你的小说文本, 开始创作          </a>


          选择 7 种预设故事模板, AI自动生成分镜和动画序列。        </p>


      </div>


    </footer>


  </div>


</template>





<style scoped>


/* ================================================================


 *  动画生成器着陆页 - Dark theme


 *  主色: #00BFA5 和 #7C3AED


 * ================================================================ */





.landing {


  --wiz-bg: #0E0F12;


  --wiz-surface: #111113;


  --wiz-surface-hover: #23262E;


  --wiz-border: #2E3139;


  --wiz-border-subtle: #1E1E22;


  --wiz-text: #E8EAED;


  --wiz-text-secondary: #9CA3AF;


  --wiz-text-muted: #52525B;


  --wiz-accent: #00BFA5;


  --wiz-accent-hover: #0D9488;


  --wiz-accent-dim: rgba(0, 191, 165, 0.12);


  --wiz-radius: 12px;


  --wiz-radius-sm: 8px;


}





/* ============ Root ============ */


.landing {


  min-height: 100vh;


  background: var(--wiz-bg);


  color: var(--wiz-text);


  font-family: inherit;


}





/* ============ Section ============ */


.section-title {


  font-size: 1.75rem;


  font-weight: 700;


  text-align: center;


  margin-bottom: 0.5rem;


}





.section-desc {


  text-align: center;


  color: var(--wiz-text-secondary);


  font-size: 0.95rem;


  margin-bottom: 2.5rem;


}





/* ================================================================


 *  Hero


 * ================================================================ */





.hero {


  padding: 5rem 1.5rem 4rem;


  max-width: 960px;


  margin: 0 auto;


}





.hero__content {


  text-align: center;


}





.hero__title {


  font-size: clamp(2rem, 5vw, 3.25rem);


  font-weight: 800;


  line-height: 1.2;


  margin-bottom: 1rem;


  letter-spacing: -0.02em;


}





.hero__title-accent {


  background: linear-gradient(135deg, var(--wiz-accent), #7C3AED);


  -webkit-background-clip: text;


  -webkit-text-fill-color: transparent;


  background-clip: text;


}





.hero__subtitle {


  font-size: 1.1rem;


  color: var(--wiz-text-secondary);


  max-width: 520px;


  margin: 0 auto 2rem;


  line-height: 1.6;


}





.hero__cta {


  display: inline-flex;


  align-items: center;


  gap: 0.6rem;


  padding: 0.9rem 2.5rem;


  background: var(--wiz-accent);


  color: var(--wiz-bg);


  border: none;


  border-radius: var(--wiz-radius);


  font-size: 1.1rem;


  font-weight: 700;


  cursor: pointer;


  transition: all 0.2s;


  margin-bottom: 3rem;


}





.hero__cta:hover {


  background: var(--wiz-accent-hover);


  transform: translateY(-1px);


  box-shadow: 0 8px 32px rgba(0, 212, 170, 0.25);


}





.hero__cta-arrow {


  display: none;


}





/* ============ Config Panel ============ */


.hero__config {


  background: var(--wiz-surface);


  border: 1px solid var(--wiz-border);


  border-radius: calc(var(--wiz-radius) * 1.5);


  padding: 2rem;


  text-align: left;


}





.config-group {


  margin-bottom: 1.5rem;


}





.config-label {


  display: block;


  font-size: 0.85rem;


  font-weight: 600;


  color: var(--wiz-text-secondary);


  text-transform: uppercase;


  letter-spacing: 0.05em;


  margin-bottom: 0.75rem;


}





/* ============ Style Grid ============ */


.style-grid {


  display: grid;


  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));


  gap: 0.5rem;


}





.style-chip {


  display: flex;


  flex-direction: column;


  align-items: flex-start;


  gap: 0.25rem;


  padding: 0.7rem 0.9rem;


  background: var(--wiz-bg);


  border: 1px solid var(--wiz-border);


  border-radius: var(--wiz-radius-sm);


  cursor: pointer;


  transition: all 0.2s;


  text-align: left;


}





.style-chip:hover {


  border-color: var(--chip-color, var(--wiz-accent));


  background: var(--wiz-surface-hover);


}





.style-chip--active {


  border-color: var(--chip-color, var(--wiz-accent));


  background: color-mix(in srgb, var(--chip-color, var(--wiz-accent)) 8%, var(--wiz-bg));


}





.style-chip__dot {


  width: 8px;


  height: 8px;


  border-radius: 50%;


  flex-shrink: 0;


}





.style-chip__label {


  font-size: 0.9rem;


  font-weight: 600;


  color: var(--wiz-text);


}





.style-chip__desc {


  font-size: 0.75rem;


  color: var(--wiz-text-muted);


}





/* ============ Hero Options Row ============ */


.hero__options {


  display: flex;


  gap: 2rem;


  flex-wrap: wrap;


}





.hero__options .config-group {


  flex: 1;


  min-width: 200px;


}





.aspect-selector {


  display: flex;


  gap: 0.5rem;


}





.aspect-btn {


  flex: 1;


  display: flex;


  flex-direction: column;


  align-items: center;


  gap: 0.35rem;


  padding: 0.75rem 0.5rem;


  background: var(--wiz-bg);


  border: 1px solid var(--wiz-border);


  border-radius: var(--wiz-radius-sm);


  cursor: pointer;


  transition: all 0.2s;


}





.aspect-btn:hover {


  border-color: var(--wiz-accent);


}





.aspect-btn--active {


  border-color: var(--wiz-accent);


  background: var(--wiz-accent-dim);


}





.aspect-btn__icon {


  font-size: 1.5rem;


  line-height: 1;


}





.aspect-btn__label {


  font-size: 0.85rem;


  font-weight: 600;


}





.aspect-btn__desc {


  font-size: 0.7rem;


  color: var(--wiz-text-muted);


  text-align: center;


}





/* ============ Episode Selector ============ */


.episode-selector {


  display: flex;


  gap: 0.5rem;


  flex-wrap: wrap;


}





.episode-btn {


  min-width: 3rem;


  padding: 0.5rem 0.9rem;


  background: var(--wiz-bg);


  border: 1px solid var(--wiz-border);


  border-radius: var(--wiz-radius-sm);


  color: var(--wiz-text-secondary);


  font-size: 0.85rem;


  font-weight: 500;


  cursor: pointer;


  transition: all 0.2s;


}





.episode-btn:hover {


  border-color: var(--wiz-accent);


  color: var(--wiz-text);


}





.episode-btn--active {


  background: var(--wiz-accent-dim);


  border-color: var(--wiz-accent);


  color: var(--wiz-accent);


  font-weight: 700;


}





/* ================================================================


 *  Showcase 展示区域 + 一键工作流配置区域


 * ================================================================ */





.showcase {


  padding: 4rem 1.5rem;


  max-width: 960px;


  margin: 0 auto;


}





.carousel {


  display: flex;


  align-items: center;


  gap: 1rem;


  margin-bottom: 1rem;


}





.carousel__btn {


  flex-shrink: 0;


  width: 44px;


  height: 44px;


  display: flex;


  align-items: center;


  justify-content: center;


  background: var(--wiz-surface);


  border: 1px solid var(--wiz-border);


  border-radius: 50%;


  color: var(--wiz-text-secondary);


  cursor: pointer;


  transition: all 0.2s;


}





.carousel__btn:hover {


  background: var(--wiz-surface-hover);


  color: var(--wiz-text);


  border-color: var(--wiz-accent);


}





.carousel__track {


  flex: 1;


  overflow: hidden;


}





.carousel__card {


  display: flex;


  gap: 1.5rem;


  background: var(--wiz-surface);


  border: 1px solid var(--wiz-border);


  border-radius: var(--wiz-radius);


  padding: 1.5rem;


  align-items: center;


}





.carousel__preview {


  flex-shrink: 0;


  width: 240px;


  height: 135px;


  border-radius: var(--wiz-radius-sm);


  overflow: hidden;


  background: var(--wiz-bg);


}





.carousel__placeholder {


  width: 100%;


  height: 100%;


  display: flex;


  align-items: center;


  justify-content: center;


  color: var(--wiz-text-muted);


  background: linear-gradient(135deg, var(--wiz-surface), var(--wiz-surface-hover));


}





.carousel__info {


  flex: 1;


}





.carousel__title {


  font-size: 1.2rem;


  font-weight: 700;


  margin-bottom: 0.35rem;


}





.carousel__desc {


  font-size: 0.9rem;


  color: var(--wiz-text-secondary);


  margin-bottom: 0.75rem;


}





.carousel__tag {


  display: inline-block;


  padding: 0.2rem 0.6rem;


  background: var(--wiz-accent-dim);


  color: var(--wiz-accent);


  border-radius: 100px;


  font-size: 0.75rem;


  font-weight: 600;


}





.carousel__dots {


  display: flex;


  justify-content: center;


  gap: 0.5rem;


}





.carousel__dot {


  width: 8px;


  height: 8px;


  border-radius: 50%;


  background: var(--wiz-border);


  border: none;


  cursor: pointer;


  transition: all 0.2s;


  padding: 0;


}





.carousel__dot--active {


  background: var(--wiz-accent);


  width: 24px;


  border-radius: 100px;


}





/* ================================================================


 *  Flow 展示: 7种预设故事模板快速开始创作
 * ==============================================





.flow {


  padding: 4rem 1.5rem;


  max-width: 960px;


  margin: 0 auto;


}





.flow__steps {


  display: flex;


  flex-direction: column;


  gap: 0;


  max-width: 600px;


  margin: 0 auto;


}





.flow-step {


  display: flex;


  align-items: flex-start;


  gap: 1rem;


  position: relative;


  padding-bottom: 1.5rem;


}





.flow-step:last-child {


  padding-bottom: 0;


}





.flow-step__number {


  position: relative;


  flex-shrink: 0;


  width: 48px;


  height: 48px;


  border-radius: 50%;


  background: var(--wiz-surface);


  border: 1px solid var(--wiz-border);


  display: flex;


  align-items: center;


  justify-content: center;


  z-index: 1;


}





.flow-step__icon {


  font-size: 1.2rem;


}





.flow-step__index {


  position: absolute;


  bottom: -4px;


  right: -4px;


  width: 18px;


  height: 18px;


  border-radius: 50%;


  background: var(--wiz-accent);


  color: var(--wiz-bg);


  font-size: 0.65rem;


  font-weight: 700;


  display: flex;


  align-items: center;


  justify-content: center;


}





.flow-step__content {


  padding-top: 0.35rem;


}





.flow-step__title {


  font-size: 1rem;


  font-weight: 600;


  margin-bottom: 0.15rem;


}





.flow-step__desc {


  font-size: 0.85rem;


  color: var(--wiz-text-muted);


  line-height: 1.5;


}





.flow-step__connector {


  position: absolute;


  left: 23px;


  top: 48px;


  width: 2px;


  height: calc(100% - 48px);


  background: var(--wiz-border);


}





/* ================================================================


 *  Footer


 * ================================================================ */





.footer {


  padding: 3rem 1.5rem;


  text-align: center;


  border-top: 1px solid var(--wiz-border);


  color: var(--wiz-text-muted);


}





.footer__content {


  max-width: 600px;


  margin: 0 auto;


}





.footer__text {


  font-size: 0.9rem;


  line-height: 1.6;


}





.footer__link {


  color: var(--wiz-accent);


  font-weight: 600;


  cursor: pointer;


  text-decoration: none;


  transition: color 0.2s;


}





.footer__link:hover {


  color: var(--wiz-accent-hover);


  text-decoration: underline;


}





/* ================================================================


 *  Responsive


 * ================================================================ */





@media (max-width: 768px) {


  .hero {


    padding: 3rem 1rem 2.5rem;


  }





  .hero__config {


    padding: 1.25rem;


  }





  .style-grid {


    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));


  }





  .hero__options {


    flex-direction: column;


    gap: 1rem;


  }





  .carousel__card {


    flex-direction: column;


  }





  .carousel__preview {


    width: 100%;


    height: 160px;


  }





  .showcase {


    padding: 2.5rem 1rem;


  }





  .flow {


    padding: 2.5rem 1rem;


  }


}


</style>


