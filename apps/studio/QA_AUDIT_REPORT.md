# 千机工坊 Studio App — QA Audit Report

**Date:** 2026-06-15
**Scope:** apps/studio/src/{views,components,composables,stores,router}
**Auditor:** QA Code Audit

---

## CRITICAL — "漫改" Concept Errors (Novel-to-Animation, NOT Novel-to-Comic)

The product "漫改" means novel-to-**animation/anime** (动画). The codebase pervasively uses comic/manga terminology instead.

### C-01 | HomeView.vue: "漫画" should be "动画" (7 instances)
| Line | Current Text | Should Be |
|------|-------------|-----------|
| 110 | `AI 驱动的漫画创作平台` | `AI 驱动的动画创作平台` |
| 244 | `创建你的漫画项目` | `创建你的动画项目` |
| 272 | `千机工坊 - AI 漫画创作平台` | `千机工坊 - AI 动画创作平台` |
| 46 | `小说 → 漫剧流水线` | `小说 → 动画流水线` |
| 51 | `name: '精品漫'` | `name: '精品动画'` |
| 52 | `name: '解说漫'` | `name: '解说动画'` |
| 258 | `AI 智能分镜` | `AI 智能镜头` |

**Severity:** CRITICAL — The platform's core identity is mislabeled. Every user sees "漫画创作平台" on the homepage.

### C-02 | HomeView.vue: "分镜" should be "镜头" or "动画帧"
| Line | Current | Should Be |
|------|---------|-----------|
| 72 | `title: '分镜', sub: '分镜生成'` | `title: '镜头', sub: '镜头生成'` |
| 126 | `{{ stats.shots }} 个分镜` | `{{ stats.shots }} 个镜头` |
| 258 | `AI 智能分镜，选择风格和机位` | `AI 智能镜头，选择风格和机位` |

### C-03 | StoryboardEditorView.vue: "分镜编辑器" naming
| Line | Current | Should Be |
|------|---------|-----------|
| 2 | `分镜编辑器（7 步向导）` | `动画编辑器（7 步向导）` |
| 139 | `分镜编辑器` | `动画编辑器` |
| 30 | `选择画风、分镜风格和后期参数` | `选择画风、镜头风格和后期参数` |
| 230 | `选择画风、分镜风格和后期参数` | `选择画风、镜头风格和后期参数` |

**Severity:** CRITICAL — The view name itself misrepresents the product concept.

### C-04 | StoryboardGridView.vue: "分镜" terminology
| Line | Current | Should Be |
|------|---------|-----------|
| 2 | `分镜宫格视图` | `镜头宫格视图` |
| 156 | `分镜宫格` | `镜头宫格` |
| 164 | `+ 新建分镜` | `+ 新建镜头` |
| 180 | `暂无分镜` | `暂无镜头` |

### C-05 | ProjectEditorView.vue: "分镜" terminology
| Line | Current | Should Be |
|------|---------|-----------|
| 221 | `title: '新分镜 ${...}'` | `title: '新镜头 ${...}'` |
| 277 | `{{ stats.total }} 个分镜` | `{{ stats.total }} 个镜头` |
| 285 | `🎞️ 分镜总览` | `🎞️ 镜头总览` |
| 290 | `+ 新分镜` | `+ 新镜头` |
| 333 | `项目还没有分镜` | `项目还没有镜头` |
| 336 | `+ 创建第一个分镜` | `+ 创建第一个镜头` |
| 362 | `分镜编辑` | `镜头编辑` |
| 85 | `title: '分镜 ${(order_index) + 1}'` | `title: '镜头 ${(order_index) + 1}'` |

### C-06 | NewProjectWizardView.vue: "漫剧" should be "动画"
| Line | Current | Should Be |
|------|---------|-----------|
| 23 | `modeNames: { premium:'精品漫', commentary:'解说漫', ...}` | `premium:'精品动画', commentary:'解说动画'` |
| 26 | `name: '精品漫', desc: '高品质漫剧\n角色精致·分镜考究'` | `name: '精品动画', desc: '高品质动画\n角色精致·镜头考究'` |
| 27 | `name: '解说漫'` | `name: '解说动画'` |
| 43 | `${modeNames[...]} 项目` (produces "精品漫 项目") | "精品动画 项目" |
| 98 | `placeholder="我的第一个漫剧项目"` | `placeholder="我的第一个动画项目"` |
| 117 | `我们将自动为您拆解小说章节、提取角色和场景` | OK but add "生成动画镜头" |

### C-07 | ShotEditorView.vue: "分镜" terminology
| Line | Current | Should Be |
|------|---------|-----------|
| 95 | `未找到对应分镜` | `未找到对应镜头` |
| 137 | `加载分镜中...` | `加载镜头中...` |

### C-08 | StudioLayout.vue: Sidebar label
| Line | Current | Should Be |
|------|---------|-----------|
| 19 | `title: '配乐编辑'` for storyboard route | Consider `title: '动画编辑'` to reflect animation workflow |

### C-09 | Router: Route name "storyboard-editor" and comment
| Line | Current | Should Be |
|------|---------|-----------|
| 66 | `// ⑥ 分镜编辑器` | `// ⑥ 动画编辑器` |
| 67 | `name: 'storyboard-editor'` | Consider `name: 'animation-editor'` |

### C-10 | useAgentChat.ts: "漫画" in AI assistant text
| Line | Current | Should Be |
|------|---------|-----------|
| 11 | `"帮我建一个漫画生成流水线"` | `"帮我建一个动画生成流水线"` |
| 17 | `label: '📖 建漫画流'` | `label: '📖 建动画流'` |

---

## HIGH — Functional Issues

### H-01 | PromoEditorView.vue is NOT registered in the router
**File:** `views/PromoEditorView.vue`
**Issue:** This 1276-line view exists but has no route in `router/index.ts`. It imports `VolumeSlider`, `AudioSelector`, `AutoScoreButton` from `@manhuaworks/ui` which may not exist as exports. The file is completely dead code.
**Severity:** HIGH
**Fix:** Either add a route or remove the file.

### H-02 | MaterialLibraryView.vue: Audio "上传音频文件" button has no handler
**File:** `views/MaterialLibraryView.vue`, line 668
**Issue:** `<button class="ml-audio-empty-link">上传音频文件</button>` has no `@click` handler.
**Severity:** HIGH
**Fix:** Add an `@click` handler with a file input or remove the button.

### H-03 | MaterialLibraryView.vue: "+ 新建作品" button does nothing
**File:** `views/MaterialLibraryView.vue`, line 1135
**Issue:** `<div class="ml-other-card ml-other-card--new"><span>+ 新建作品</span></div>` has no `@click` handler.
**Severity:** HIGH

### H-04 | MaterialLibraryView.vue: Hardcoded mock projects never cleared on success
**File:** `views/MaterialLibraryView.vue`, lines 56-60
**Issue:** Mock projects `['长安月下', '剑破苍穹', '深空遗民']` are initialized as a ref. When API succeeds, they're replaced, but the `activeProject` may reference a stale ID during the transition, causing empty views.
**Severity:** MEDIUM

### H-05 | StoryboardEditorView.vue: File upload not implemented
**File:** `views/StoryboardEditorView.vue`, lines 180-191
**Issue:** The upload zone says "拖拽文件到此处，或点击选择" but has no `@drop`, `@dragover`, or file input element. Only the textarea works.
**Severity:** HIGH

### H-06 | StoryboardEditorView.vue: projectName is hardcoded "未命名项目"
**File:** `views/StoryboardEditorView.vue`, line 85
**Issue:** `projectName` is `ref('未命名项目')` and never loaded from API or route params.
**Severity:** MEDIUM

### H-07 | HomeView.vue: pipelineSteps route `/project` for step 3 and 5 are ambiguous
**File:** `views/HomeView.vue`, lines 72, 74
**Issue:** Steps 3 (镜头) and 5 (配乐) both link to `/project` which goes to the project list, not the specific project's editor or storyboard.
**Severity:** MEDIUM

### H-08 | SceneEditView.vue / CharacterEditView.vue: Hardcoded "主角" badge
**File:** `views/CharacterEditView.vue`, line 191
**Issue:** `<span class="badge badge-purple">主角</span>` is always "主角" regardless of the character's actual archetype.
**Severity:** MEDIUM

### H-09 | SceneEditView.vue: Hardcoded "室内" badge
**File:** `views/SceneEditView.vue`, line 195
**Issue:** `<span class="badge badge-amber">室内</span>` is always "室内" regardless of the scene's actual type.
**Severity:** MEDIUM

### H-10 | BranchConfigView.vue: `br-count` margin-left:auto is on wrong element
**File:** `views/BranchConfigView.vue`, line 132
**Issue:** `.br-count` has `margin-left: auto` in CSS, but the save button also has `style="margin-left:auto"`, causing a layout conflict.
**Severity:** LOW

---

## MEDIUM — Hardcoded Mock Data / Missing API Integration

### M-01 | MaterialLibraryView.vue: 6 hardcoded audio items
**File:** `views/MaterialLibraryView.vue`, lines 153-190
**Issue:** `audioItems` ref is populated with 6 hardcoded mock audio entries. No API integration for audio.
**Severity:** MEDIUM

### M-02 | StoryboardGridView.vue: MOCK_SHOTS fallback
**File:** `views/StoryboardGridView.vue`, lines 40-49
**Issue:** 8 hardcoded mock shots used as fallback. This is acceptable as a fallback but the toast "已使用示例数据" should be more visible.
**Severity:** LOW

### M-03 | MaterialLibraryView.vue: generatePreviews() uses setTimeout simulation
**File:** `views/MaterialLibraryView.vue`, lines 408-429
**Issue:** AI image generation is simulated with `setTimeout`. Marked with `// TODO: 接入真 AI API` at line 498.
**Severity:** MEDIUM — Expected for dev but needs tracking.

### M-04 | useAgentChat.ts: All AI responses are hardcoded mock
**File:** `composables/useAgentChat.ts`, lines 36-42
**Issue:** All agent responses are hardcoded strings. No real AI integration. The comment says "production: call /v1/agent/chat".
**Severity:** MEDIUM — Expected but should be tracked.

### M-05 | CharacterView.vue: members are all hardcoded
**File:** `views/CharacterView.vue`, lines 91-97
**Issue:** Team members are hardcoded local data, not fetched from any API.
**Severity:** MEDIUM

---

## MEDIUM — Architecture Issues

### A-01 | MaterialLibraryView.vue: 1672 lines — component too large
**File:** `views/MaterialLibraryView.vue`
**Issue:** Single-file component with 1672 lines. Contains audio system, material CRUD, image editing, project switching, modals, and 3 different views. Should be split into at least 4 components.
**Severity:** MEDIUM
**Fix:** Extract `AudioListView`, `MaterialGridView`, `CreateMaterialModal`, `EditImageModal` as separate components.

### A-02 | WorkflowDesignerView.vue: 1406 lines
**File:** `views/WorkflowDesignerView.vue`
**Issue:** Despite being refactored to use 4 composables, the template and styles are still 1406 lines. The AI Agent panel, modals, and event panel should be extracted.
**Severity:** MEDIUM

### A-03 | PromoEditorView.vue: 1276 lines — dead code
**File:** `views/PromoEditorView.vue`
**Issue:** 1276 lines of dead code (not registered in router).
**Severity:** HIGH — Should be removed or properly integrated.

### A-04 | Button/input styles copy-pasted across 10+ view files
**Files:** All "派单 33C" views (ShotEditorView, StoryboardGridView, ProjectSettingsView, CharacterEditView, SceneEditView, NodeConfigView, BatchGenerateView, BranchConfigView, ExportSettingsView)
**Issue:** Each view independently defines `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input`, `.badge` etc. in `<style scoped>`. These should be shared CSS or use the design system.
**Severity:** MEDIUM
**Fix:** Move to shared CSS or use `@manhuaworks/ui` component library.

### A-05 | HomeView.vue: Duplicate CSS for `.home-pipeline`
**File:** `views/HomeView.vue`, lines 404-408
**Issue:** `.home-pipeline` is defined twice (lines 404 and 406), with the second definition overriding the first.
**Severity:** LOW

### A-06 | StudioLayout.vue: Hardcoded project ID in sidebar
**File:** `components/StudioLayout.vue`, line 19
**Issue:** `{ name: 'storyboard', title: '配乐编辑', icon: '🎼', to: '/project/1/storyboard' }` — hardcoded `/project/1/`. Should use current project's ID.
**Severity:** HIGH

### A-07 | ExportSettingsView.vue: Route params mismatch
**File:** `views/ExportSettingsView.vue`, line 51
**Issue:** `route.params.projectId` but the route is defined as `/export/settings` with no `projectId` param. Will always fall back to `'default'`.
**Severity:** HIGH

---

## MEDIUM — UI/UX Quality Issues

### UX-01 | CharacterEditView.vue: Expression count label hardcoded
**File:** `views/CharacterEditView.vue`, line 203
**Issue:** `<div class="section-title">😊 表情集 (12)</div>` — count is hardcoded "(12)" instead of `{{ expressions.length }}`.
**Severity:** MEDIUM

### UX-02 | SceneEditView.vue: Sub-scene count label hardcoded
**File:** `views/SceneEditView.vue`, line 205
**Issue:** `<div class="section-title">📐 子场景 (3)</div>` — count is hardcoded "(3)" instead of `{{ subScenes.length }}`.
**Severity:** MEDIUM

### UX-03 | MaterialLibraryView.vue: Audio play does not actually play audio
**File:** `views/MaterialLibraryView.vue`, lines 222-224
**Issue:** `toggleAudioPlay()` only toggles the `playingAudioId` ref. No actual `<audio>` element or Web Audio API is used. The waveform animation is CSS-only.
**Severity:** MEDIUM — Visual feedback is fine for mock, but users may expect actual audio.

### UX-04 | ExportView.vue: `downloadRecord` mock URLs don't download
**File:** `views/ExportView.vue`, lines 212-223
**Issue:** Mock blob URLs show a toast "模拟导出暂不支持下载" instead of actually downloading. This is expected in mock mode but should be clearly indicated.
**Severity:** LOW

### UX-05 | StoryboardEditorView.vue: No step validation before proceeding
**File:** `views/StoryboardEditorView.vue`, lines 125-128
**Issue:** `canProceed()` always returns `true`. Users can skip through all steps without completing any. The "下一步" button marks current step complete unconditionally.
**Severity:** MEDIUM

### UX-06 | ProjectSettingsView.vue: Permission toggles are non-functional
**File:** `views/ProjectSettingsView.vue`, lines 236-268
**Issue:** Permission items show static "已开启"/"未开启" badges with no toggle controls. The note says "权限配置将在后续版本中支持".
**Severity:** LOW — Clearly marked as future work.

### UX-07 | SceneView.vue: Edit button disabled
**File:** `views/SceneView.vue`, line 475
**Issue:** API scene card edit button has `disabled` attribute with no explanation. Users can't edit API scenes.
**Severity:** MEDIUM

### UX-08 | WorkflowDesignerView.vue: New workflow modal reuses `.ml-` CSS classes
**File:** `views/WorkflowDesignerView.vue`, lines 584-601
**Issue:** The modal uses `.ml-field`, `.ml-input`, `.ml-btn` CSS classes that are defined in MaterialLibraryView.vue's scoped styles. These styles won't apply because they're scoped to that component.
**Severity:** HIGH — The modal will render unstyled.

---

## LOW — Text/Copy Issues

### T-01 | HomeView.vue: "新手指南" step 3 says "生成分镜"
**File:** `views/HomeView.vue`, line 257
**Issue:** Should be "生成镜头" per animation concept (see C-02).

### T-02 | HomeView.vue: Footer says "AI 漫画创作平台"
**File:** `views/HomeView.vue`, line 272
**Issue:** Should be "AI 动画创作平台" (see C-01).

### T-03 | PlaceholderView.vue: "W3" pending label
**File:** `views/PlaceholderView.vue`, line 25
**Issue:** `pending` defaults to `'W3'` which is an internal sprint reference, not user-facing text.
**Severity:** LOW

### T-04 | ExportView.vue: "5 大类" in header but `activeCategoryChips` has 6 items
**File:** `views/ExportView.vue`, line 258 vs 69
**Issue:** Header says "5 大类" but `activeCategoryChips` includes `'all', 'episode', 'character', 'project', 'asset', 'video'` = 5 categories + all. The header text should be dynamic or say "6 大类".
**Severity:** LOW

### T-05 | ToolboxView.vue: "7 大类" but composable defines 6 categories
**File:** `views/ToolboxView.vue`, line 127
**Issue:** Header says `7 大类 · {{ tools.length }} 工具` but `ToolboxCategory` only has 7 types: `'text', 'character', 'plot', 'dialogue', 'world', 'export', 'audio'` = 7. Actually matches. OK.
**Severity:** N/A (false alarm)

### T-06 | NewProjectWizardView.vue: "Archetype" label in English
**File:** `views/NewProjectWizardView.vue`, line 108
**Issue:** `<label class="form-label">Archetype</label>` — should be "角色原型" or "角色类型" for Chinese UI consistency.
**Severity:** LOW

### T-07 | CharacterEditView.vue: "Archetype" label in English
**File:** `views/CharacterEditView.vue`, line 214
**Issue:** Same as T-06. `<label class="form-label">Archetype</label>` should be Chinese.
**Severity:** LOW

### T-08 | SceneEditView.vue: Color temperature range labels swapped
**File:** `views/SceneEditView.vue`, line 235
**Issue:** `<span>冷 (2000K)</span>...<span>暖 (8000K)</span>` — 2000K is actually warm (candlelight) and 8000K is cool (overcast sky). The labels are inverted.
**Severity:** MEDIUM

---

## LOW — Dead Code / Unused Imports

### D-01 | ProjectEditorView.vue: Unused imports
**File:** `views/ProjectEditorView.vue`, lines 15-18
**Issue:** Imports `SCENE_TEMPLATES_V2`, `getArchetypeMeta` from character-archetypes-v2, `SCENE_TEMPLATES` from scene types, and `CHARACTER_ARCHETYPES` from character types but some may be unused (e.g., `SCENE_TEMPLATES_V2` is imported but `SCENE_TEMPLATES` is used in the template).
**Severity:** LOW

### D-02 | PromoEditorView.vue: Entire file is dead code
**File:** `views/PromoEditorView.vue`
**Issue:** Not referenced in router. 1276 lines of dead code.
**Severity:** HIGH (see A-03)

### D-03 | WorkflowDesignerView.vue: `pipelineLabel` function may be dead code
**File:** `views/WorkflowDesignerView.vue`, lines 258-260
**Issue:** `pipelineLabel()` is defined and used in the template for retry buttons (line 450). Not dead code on closer inspection.
**Severity:** N/A

---

## Summary by Severity

| Severity | Count | Key Themes |
|----------|-------|------------|
| CRITICAL | 10 | "漫画" vs "动画", "分镜" vs "镜头" throughout the app |
| HIGH | 10 | Dead files, missing handlers, hardcoded routes, broken CSS scoping |
| MEDIUM | 18 | Mock data, oversized components, copy-paste CSS, hardcoded badges |
| LOW | 10 | English labels, dead CSS, minor text issues |

### Top 3 Priorities

1. **Fix all "漫改" concept errors (C-01 through C-10):** The entire app says "漫画" (comic) when it should say "动画" (animation). This is a product-defining issue. Affects ~40+ text strings across 8 files.

2. **Remove or register PromoEditorView.vue (H-01/A-03):** 1276 lines of dead code that imports potentially non-existent UI components.

3. **Fix StudioLayout hardcoded project ID (A-06):** The sidebar links to `/project/1/storyboard` which will break for any project other than ID "1".
