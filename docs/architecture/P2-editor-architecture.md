# P2 缂栬緫鍣ㄦ暣鍚?鈥?鏋舵瀯璁捐�℃枃妗�

> **浣滆�?*: 绋嬫瀯锛堝紑鍙戦儴闀?鎬绘灦鏋勫笀锛?> **鏃ユ湡**: 2026-06-21
> **鐗堟湰**: v1.0
> **娲惧崟**: 闄堣繙鏋?娲惧崟39 鍗冩満宸ュ潑v3.0 P2 缂栬緫鍣ㄦ暣鍚?
---

## 鐩�褰�

1. [鐜扮姸瀹¤��: 缂栬緫鍣ㄦ竻鍗昡(#1-鐜扮姸瀹¤��-缂栬緫鍣ㄦ竻鍗?
2. [涓�閿�鍒涗綔鏋舵瀯璁捐��](#2-涓�閿�鍒涗綔鏋舵瀯璁捐�?
3. [API 濂戠害](#3-api-濂戠害)
4. [缁勪欢鏍戜笌鏁版嵁娴乚(#4-缁勪欢鏍戜笌鏁版嵁娴?
5. [P2 娲惧崟寤鸿�甝(#5-p2-娲惧崟寤鸿��)
6. [鍙樻洿璁板綍](#6-鍙樻洿璁板綍)

---

## 1. 鐜扮姸瀹¤��: 缂栬緫鍣ㄦ竻鍗?
### 1.1 鏍稿績 6 缂栬緫鍣?
| # | 缂栬緫鍣?| 鏂囦欢 | 澶у皬 | 鍙�娓叉�?| Import 鍋ュ悍 | 澶囨敞 |
|---|--------|------|------|--------|-------------|------|
| 鈶?| 灏忚�村垱浣� | `NovelEditorView.vue` | 77KB | 鉁?| 鉁?绾?`@/` alias | 3姝ユ祦绋?杈撳叆鈫扐I鐢熸垚鈫掑�煎�?锛屽凡鎺ョ湡API |
| 鈶?| 婕�鏀瑰伐鍧�(Pro) | `StoryboardEditorView.vue` | 25KB | 鉁?| 鉁?鍚岀洰褰曠浉瀵瑰�煎�?`./StoryboardStep5Music.vue` | 7姝ュ悜瀵硷紝鐢?`route.query.step` 璺虫�� |
| 鈶?| 瀹ｄ紶鐗?| `PromoEditorView.vue` | 82KB | 鉁?| 鉁?娣峰悎 alias+package | 浣跨敤 CRAFT prompt composable |
| 鈶?| 骞垮憡鐭�鐗� | `AdShortEditorView.vue` | 88KB | 鉁?| 鈿狅笍 `../../api/craft-prompt` | 搴旂敤 `@/` alias 鏇夸唬鐩稿�瑰�煎叆 |
| 鈶?| 骞垮憡鍥?| `AdImageEditorView.vue` | 50KB | 鉁?| 鉁?浠?`vue` 鏍稿績瀵煎叆 | 鏈�绠�娲佺殑缂栬緫鍣?|
| 鈶?| 闊充箰鐢熸垚 | `MusicEditorView.vue` | 70KB | 鉁?| 鉁?`@/api/ai-generate` | 宸叉帴鐪熷疄 generateMusic API |

### 1.2 杈呭姪瑙嗗浘锛坈reate/ 鐩�褰曚笅锛�

| 瑙嗗浘 | 鏂囦欢 | 鍙�娓叉�?| Import 鍋ュ悍 | 澶囨敞 |
|------|------|--------|-------------|------|
| 鍔ㄧ敾钀藉湴椤?| `MangaLandingView.vue` | 鉁?| 鉁?alias | 鈿狅笍 鍚?mock 浠ｇ爜鏈�娓咃�?姝ユ祦绋嬩笌 StoryboardEditorView 閲嶅彔 |
| 鍒嗛暅缃戞牸 | `StoryboardGridView.vue` | 鉁?| 鈿狅笍 `../../components/ImagePreview.vue` | 寤鸿��缁熶竴涓?`@/` alias |
| 鍒嗛暅Step5闊充箰 | `StoryboardStep5Music.vue` | 鉁?| 鈿狅笍 `../../composables/musicScore` | 寤鸿��缁熶竴涓?`@/` alias |
| 鎵规�＄敓鎴� | `BatchGenerateView.vue` | 鉁?| 鈿狅笍 `../../stores/workflow`, `../../composables/useWorkflowRunner` | 寤鸿��缁熶竴涓?`@/` alias |
| 瀵煎嚭 | `ExportView.vue` | 鉁?| 鈿狅笍 `../../stores/project`, `../../composables/export` | 寤鸿��缁熶竴涓?`@/` alias |
| 瀵煎嚭璁剧疆 | `ExportSettingsView.vue` | 鉁?| 鈿狅笍 `../../api-bridge` | 寤鸿��缁熶竴涓?`@/` alias |
| 婕�鏀圭粨鏋� | `MangaResultView.vue` | 鉁?| 鉁?| 杞婚噺缁撴灉灞曠ず椤?|

### 1.3 Import 瑙勮寖闂�棰樻眹鎬?
**缁撹��**: 鍏ㄩ儴 13 涓�瑙嗗浘鍧囧彲娓叉煋锛屾棤鏂�閾?缂轰緷璧栥�備絾鏈?**6 涓�鏂囦�?*浣跨敤浜?`../../` 鐩稿�硅矾寰勫�煎叆锛屼笌椤圭洰 `@/` alias 瑙勮寖涓嶄竴鑷达細

| 鏂囦欢 | 鐩稿�瑰�煎叆 | 寤鸿��鏀逛负 |
|------|---------|---------|
| `AdShortEditorView.vue` | `../../api/craft-prompt` | `@/api/craft-prompt` |
| `BatchGenerateView.vue` | `../../stores/workflow` | `@/stores/workflow` |
| `BatchGenerateView.vue` | `../../composables/useWorkflowRunner` | `@/composables/useWorkflowRunner` |
| `ExportView.vue` | `../../stores/project` | `@/stores/project` |
| `ExportView.vue` | `../../composables/export` | `@/composables/export` |
| `ExportSettingsView.vue` | `../../api-bridge` | `@/api-bridge` |
| `StoryboardGridView.vue` | `../../components/ImagePreview.vue` | `@/components/ImagePreview.vue` |
| `StoryboardGridView.vue` | `../../stores/project` | `@/stores/project` |
| `StoryboardStep5Music.vue` | `../../composables/musicScore` | `@/composables/musicScore` |

**涓ラ噸鎬?*: 浣?鈥?涓嶅奖鍝嶅姛鑳斤紝灞炰簬浠ｇ爜椋庢牸涓�鑷存�ч棶棰橈紝P2 椤哄甫缁熶竴鍗冲彲銆?
### 1.4 MangaLandingView 鐜扮姸鍒嗘瀽锛堝叧閿�鍙戠幇锛�

`MangaLandingView.vue` (90KB) 涓?`StoryboardEditorView.vue` (25KB) 瀛樺湪**鍔熻兘閲嶅彔**锛?
| 缁村害 | MangaLandingView | StoryboardEditorView |
|------|-----------------|---------------------|
| 娴佺▼ | 7姝ワ紙灏忚�粹啋鍓ф湰鈫掑垎闀溾啋鍙傝�冨浘鈫掔敾闈⑩啋瑙嗛�戔啋閰嶄箰锛� | 7姝ワ紙涓婁紶灏忚�粹啋瑙掕壊鈫掑満鏅�鈫掗�庢牸鈫掗厤涔愨啋棰勮�堚啋瀵煎嚭锛?|
| 姝ラ�ゅ悕绉� | 涓嶅悓浣嗚�嗙洊鐩稿悓璇�涔?| 涓嶅悓浣嗚�嗙洊鐩稿悓璇�涔?|
| API 鐘舵�?| 鈿狅笍 澶ч噺 `[mock] TODO` | 鉁?宸查儴鍒嗘帴鐪?API |
| 浠ｇ爜閲?| 90KB锛?015琛岃剼鏈�锛� | 25KB锛?41琛岃剼鏈�锛� |
| 璺�鐢� | `/manga` (鏃? | `/create/animation` (P1 宸茶縼鍏? |
| 瀹氫綅 | 鍔ㄧ敾鐢熸垚鍣ㄨ惤鍦伴〉锛堟棫 studio锛?| 7姝ヤ笓涓氱紪杈戝櫒锛堟柊 web锛?|

**鏋舵瀯鍐崇瓥**: P2 涓嶅簲鍚屾椂缁存姢涓や釜 7 姝ョ紪杈戝櫒銆俙MangaLandingView` 鐨勯噸鍙犲姛鑳藉簲鏁村悎鍒?`StoryboardEditorView`锛岃�?`MangaLandingView` 鏈�韬�鏀归�犱负**涓�閿�鍒涗綔鍏ュ�?*銆?
---

## 2. 涓�閿�鍒涗綔鏋舵瀯璁捐�?
### 2.1 鏍稿績璁捐�″師鍒�

```
鈹屸攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?鈹? 鍘熷垯1: 涓�濂椾唬鐮佷袱涓�妯″�?鈥?涓嶆槸涓ゅ�楃嫭绔嬬紪杈戝�?              鈹?鈹? 鍘熷垯2: 涓�閿�妯″�?= 鍚庣��鑷�鍔ㄧ紪鎺� 鈥?鍓嶇��鍙�绠¤緭鍏�+杩涘害         鈹?鈹? 鍘熷垯3: 涓撲笟妯″紡 = 鐜版湁7姝ョ紪杈戝櫒 鈥?闆剁牬鍧忥紝澧為噺鍙犲姞          鈹?鈹? 鍘熷垯4: 妯″紡鍒囨崲涓嶄涪鏁版嵁 鈥?涓�閿�妯″紡鐨勪腑闂翠骇鐗╁彲鍦ㄤ笓涓氭ā寮忕紪杈�  鈹?鈹斺攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?```

### 2.2 涓ょ�嶆ā寮忓�规瘮

| 缁村害 | 妯″紡A: 涓�閿�鍒涗�?| 妯″紡B: 涓撲笟妯″紡 |
|------|----------------|---------------|
| **鐩�鏍囩敤鎴�** | 鏂版墜/蹇�閫熷嚭鐗?| 楂樼骇鐢ㄦ埛/闇�瑕佺簿缁嗗寲鎺у埗 |
| **鍓嶇��澶嶆潅搴?* | 杈撳叆妗?+ 杩涘害鏉?| 7姝ュ悜瀵硷紙鐜版湁 StoryboardEditorView锛?|
| **鍚庣��鑱岃矗** | ai-orchestrator 鑷�鍔ㄧ紪鎺掑叏娴佺�?| 姣忔�ョ嫭绔� API锛岀敤鎴锋墜鍔ㄨЕ鍙?|
| **姝ラ�ゅ彲瑙佹�?* | 瀵圭敤鎴蜂笉鍙�瑙侊紙杩涘害鏉℃樉绀哄綋鍓嶉樁娈碉�?| 7姝ュ畬鍏ㄥ彲瑙侊紝鍙�缂栬緫涓�闂寸粨鏋?|
| **涓�闂翠骇鐗�** | 鍚庣��鏆傚瓨锛屽彲杞�涓撲笟妯″紡鏌ョ�?| 鍓嶇��鐩存帴鎿嶄綔鍜岀紪杈?|
| **WebSocket** | 瀹炴椂鎺ㄩ�佹瘡姝ュ畬鎴?杩涘害鐧惧垎姣?| 鍙�閫夋嫨锛堝凡鏈?subscribeRun锛?|
| **榛樿�よ矾鐢�** | `/create/animation?mode=simple` | `/create/animation?mode=pro` |

### 2.3 URL 妯″紡鍒囨崲鏈哄埗

```
/create/animation                  鈫?榛樿�や竴閿�妯″紡锛堟柊鐢ㄦ埛鍙嬪ソ锛�
/create/animation?mode=pro         鈫?涓撲笟妯″紡锛?姝ョ紪杈戝櫒锛?/create/animation?mode=simple      鈫?涓�閿�妯″紡锛堟樉寮忔寚瀹氾�?/create/animation?mode=pro&step=3  鈫?涓撲笟妯″紡鐩存帴璺冲埌绗?姝?```

**鍒囨崲閫昏緫**锛堜吉浠ｇ爜锛夛細

```typescript
// 鍏ュ彛缁勪欢: CreateMangaEntry.vue (鏂板��)
function resolveMode(route): 'simple' | 'pro' {
  // 1. URL 鍙傛暟寮哄埗瑕嗙洊
  if (route.query.mode === 'pro') return 'pro'
  if (route.query.mode === 'simple') return 'simple'
  
  // 2. 鐢ㄦ埛鍋忓ソ锛堝瓨鍌ㄥ湪 user-service锛?  const prefs = useUserPrefs()
  if (prefs.mangaEditorMode) return prefs.mangaEditorMode
  
  // 3. 榛樿�わ細鏂扮敤鎴蜂竴閿�锛岃�佺敤鎴蜂笓涓?  return isNewUser.value ? 'simple' : 'pro'
}
```

**妯″紡鎸佷箙鍖?*锛?- 鐢ㄦ埛鍒囨崲妯″紡鍚?鈫?`PUT /v1/users/me/preferences { mangaEditorMode: 'pro' }`
- 涓嬫�¤�块棶 `/create/animation` 鑷�鍔ㄦ仮澶嶄笂娆￠�夋嫨
- 楂樼骇鐢ㄦ埛鍒囧埌涓撲笟妯″紡鍚庝笉鍐嶅洖鍒颁竴閿?
### 2.4 涓�閿�妯″紡鍓嶇��鏋舵�?
#### 鏂板�炵粍浠�

```
components/create/
鈹溾攢鈹� OneClickEntry.vue          # 涓�閿�妯″紡涓诲叆鍙ｏ紙鏂板�烇級
鈹?  鈹溾攢鈹� OneClickInput.vue      # 杈撳叆鍖猴細鏂囨湰杈撳叆 + 閰嶇疆椤癸紙鏂板�烇�?鈹?  鈹溾攢鈹� OneClickProgress.vue   # 杩涘害鍖猴細7姝ヨ繘搴︽潯 + 瀹炴椂棰勮�堬紙鏂板�烇級
鈹?  鈹斺攢鈹� OneClickResult.vue     # 缁撴灉鍖猴細瑙嗛�戞挱鏀� + 瀵煎嚭鎸夐挳锛堟柊澧烇級
鈹斺攢鈹� ModeSwitcher.vue           # 妯″紡鍒囨崲鎸夐挳缁勶紙鏂板�烇紝鍙�澶嶇敤锛?```

#### 澶嶇敤鐜版湁缁勪欢

| 鐜版湁缁勪欢 | 澶嶇敤鍦烘櫙 |
|---------|---------|
| `MainLayout.vue` | 宸插寘鍚?immersive 妯″紡鏀�鎸� |
| `useModuleBridge` | 璺ㄦā鍧楄仈鍔�锛坣ovel鈫抦anga 妗ユ�佸凡瀛樺湪锛� |
| `useWorkflowRunner` | 鍚?run + WebSocket 璁㈤槄锛堝凡鏈?startRun/subscribeRun锛?|
| `ExportView.vue` | 涓�閿�瀹屾垚鍚庤烦杞�鍒板�煎嚭椤� |
| `useWebSocket.ts` | WebSocket 杩炴帴绠＄悊 |

#### 缁勪欢鏍?
```
CreateMangaEntry.vue 锛堟柊澧炶矾鐢卞叆鍙ｏ級
鈹溾攢鈹� ModeSwitcher.vue                       # 妯″紡鍒囨崲
鈹溾攢鈹� [mode=simple]
鈹?  鈹斺攢鈹� OneClickEntry.vue
鈹?      鈹溾攢鈹� OneClickInput.vue             # Step 0: 杈撳叆鏂囨湰
鈹?      鈹?  鈹溾攢鈹� <textarea>                 # 灏忚��/鍓ф湰杈撳叆
鈹?      鈹?  鈹溾攢鈹� 閰嶇疆闈㈡澘
鈹?      鈹?  鈹?  鈹溾攢鈹� 椋庢牸閫夋嫨 (澶嶇敤 MangaLandingView 椋庢牸棰勮��)
鈹?      鈹?  鈹?  鈹溾攢鈹� 鐢诲箙閫夋嫨 (16:9 / 9:16)
鈹?      鈹?  鈹?  鈹斺攢鈹� 闆嗘暟閫夋嫨 (1-6)
鈹?      鈹?  鈹斺攢鈹� <button> 涓�閿�鐢熸�?鈹?      鈹溾攢鈹� OneClickProgress.vue           # Steps 1-7: 杩涘害璺熻釜
鈹?      鈹?  鈹溾攢鈹� 杩涘害鏉?(7/7)
鈹?      鈹?  鈹溾攢鈹� 褰撳墠姝ラ�ゅ悕绉�
鈹?      鈹?  鈹斺攢鈹� 瀹炴椂缂╃暐鍥鹃�勮�?鈹?      鈹斺攢鈹� OneClickResult.vue             # 缁撴灉灞曠ず
鈹?          鈹溾攢鈹� 瑙嗛�戞挱鏀惧�?鈹?          鈹溾攢鈹� 鍒囨崲鍒颁笓涓氭ā寮忕紪杈?鈹?          鈹斺攢鈹� 瀵煎嚭鎸夐挳 鈫?ExportView
鈹斺攢鈹� [mode=pro]
    鈹斺攢鈹� StoryboardEditorView.vue           # 鐜版湁 7 姝ョ紪杈戝櫒锛堥浂鏀瑰姩锛?        鈹斺攢鈹� StoryboardStep5Music.vue
```

### 2.5 涓�閿�妯″紡鏁版嵁娴�

```
鈹屸攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?鈹?鍓嶇��                                                              鈹?鈹?                                                                  鈹?鈹? OneClickInput 鈹�鈹�POST鈹�鈹�> /v1/orchestrator/jobs                    鈹?鈹? {                                                               鈹?鈹?   type: "one-click-manga",                                      鈹?鈹?   payload: { text, style, aspectRatio, episodeCount }           鈹?鈹?   projectId: "proj-xxx" (optional)                              鈹?鈹? }                                                               鈹?鈹?      鈹?                                                          鈹?鈹?      鈻?                                                          鈹?鈹? OneClickProgress <鈹�鈹�WebSocket鈹�鈹� /ws/orchestrator/jobs/{jobId}   鈹?鈹? {                                                               鈹?鈹?   type: "step-completed" | "step-failed" | "job-completed"      鈹?鈹?   step: 1..7                                                     鈹?鈹?   stepName: "瑙掕壊璁惧畾" | "鍦烘櫙璁惧畾" | ...                        鈹?鈹?   progress: 14.3, 28.6, 42.9, ...                               鈹?鈹?   previewUrl?: string  (姣忔�ヤ骇鍑虹殑棰勮�?                          鈹?鈹? }                                                               鈹?鈹?      鈹?                                                          鈹?鈹?      鈻?                                                          鈹?鈹? OneClickResult                                                     鈹?鈹? GET /v1/orchestrator/jobs/{jobId} 鈫?result.videoUrl, ...        鈹?鈹斺攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?                              鈹?                              鈹?鈹屸攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈻尖攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?鈹?鍚庣�� (ai-orchestrator:8088)                                      鈹?鈹?                                                                  鈹?鈹? POST /v1/orchestrator/jobs                                      鈹?鈹? 鈹屸攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?    鈹?鈹? 鈹?one-click-manga Pipeline (鏂板��)                          鈹?    鈹?鈹? 鈹?                                                         鈹?    鈹?鈹? 鈹? Step 1: 瑙掕壊鎻愬彇        鈫?ai-router /chat              鈹?    鈹?鈹? 鈹? Step 2: 鍦烘櫙璁惧畾        鈫?ai-router /chat              鈹?    鈹?鈹? 鈹? Step 3: 椋庢牸鍒嗘瀽        鈫?ai-router /chat              鈹?    鈹?鈹? 鈹? Step 4: 鍒嗛暅鐢熸垚        鈫?workflow-engine              鈹?    鈹?鈹? 鈹? Step 5: 鍥惧儚鐢熸垚        鈫?ai-router /image             鈹?    鈹?鈹? 鈹? Step 6: 瑙嗛�戠敓鎴�        鈫?ai-router /video             鈹?    鈹?鈹? 鈹? Step 7: 閰嶄箰+鍚堟垚       鈫?ai-router /audio + compose   鈹?    鈹?鈹? 鈹?                                                         鈹?    鈹?鈹? 鈹? 姣忔�ュ畬鎴� 鈫?WebSocket push 杩涘害 + 棰勮��                   鈹?    鈹?鈹? 鈹? 涓�闂翠骇鐗� 鈫?鏆傚瓨鍒?project-service (asset 琛?            鈹?    鈹?鈹? 鈹? 鏈�缁堣緭鍑?鈫?asset-service (video URL)                    鈹?    鈹?鈹? 鈹斺攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?    鈹?鈹?                                                                  鈹?鈹? 璋冪敤閾?                                                          鈹?鈹?   ai-orchestrator 鈫?ai-router (鏂囨湰/鍥惧儚/瑙嗛��/闊抽�戠敓鎴�)          鈹?鈹?   ai-orchestrator 鈫?asset-service (瀛樺偍涓�闂翠骇鐗�)                 鈹?鈹?   ai-orchestrator 鈫?billing-service (閰嶉�濇秷鑰?                   鈹?鈹?   ai-orchestrator 鈫?project-service (鍒涘缓/鏇存柊椤圭洰)              鈹?鈹斺攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?```

### 2.6 鍚庣�� Pipeline 娉ㄥ唽锛坅i-orchestrator锛?
**鐜扮姸**: 宸叉湁 6 涓?job type 娉ㄥ唽鍦?`pipelines/registry.ts`锛?- `image` 鈫?`style-transfer`
- `character` 鈫?`character-replace`
- `scene` 鈫?`novel-to-drama`
- `workflow` 鈫?`episode-batch`
- `decompose` 鈫?`decompose`
- `compose` 鈫?`compose-video`

**P2 鏂板��**:

```typescript
// pipelines/registry.ts 杩藉姞
{
  type: "one-click-manga",
  pipelineName: "one-click-manga",        // 鏂板�� pipeline
  description: "涓�閿�鍒涗綔锛氭枃鏈�鈫掕�掕壊鈫掑満鏅�鈫掗�庢牸鈫掑垎闀溾啋鐢婚潰鈫掕�嗛�戔啋閰嶄�?,
  estimatedTime: "5-15 min",
}

// 鏂板�� pipeline 鏂囦欢: pipelines/one-click-manga.ts
// 鍐呴儴澶嶇敤鐜版湁 pipeline锛?//   1. novel-to-drama       鈫?灏忚�粹啋鍓ф�?//   2. character-replace    鈫?瑙掕壊鎻愬彇
//   3. style-transfer       鈫?椋庢牸鍒嗘瀽
//   4. decompose            鈫?鍒嗛暅鎷嗗垎
//   5. episode-batch        鈫?鍥惧儚鎵归噺鐢熸垚
//   6. compose-video        鈫?瑙嗛�戝悎鎴�
//   7. auto-music           鈫?閰嶄箰鐢熸垚锛堟柊澧炲瓙 pipeline锛岃皟鐢?ai-router /audio锛?```

### 2.7 妯″紡鍒囨崲鏃剁殑鏁版嵁淇濈暀

**鍦烘櫙**: 鐢ㄦ埛鍦ㄤ竴閿�妯″紡鐢熸垚鍒� Step 4锛屾兂鍒囨崲鍒颁笓涓氭ā寮忓井璋冨垎闀溿�?
```
涓�閿�妯″�?Step 4 瀹屾垚 鈫?涓�闂翠骇鐗╁凡瀛樺�?project-service
                     鈫?鐢ㄦ埛鐐?鍒囨崲鍒颁笓涓氭ā寮忕紪杈?
                     鈫?鍓嶇��: router.push(`/create/animation?mode=pro&step=4&projectId=${job.projectId}`)
                     鈫?StoryboardEditorView 鍔犺浇 projectId 瀵瑰簲鐨勪腑闂翠骇鐗?鈫?Step 1-4 鏄剧ず宸茬敓鎴愬唴瀹癸紙涓嶅彲缂栬緫浣嗗彲鏌ョ湅锛?鈫?Step 5-7 杩涘叆缂栬緫鐘舵�?```

**API 鏀�鎸�**:
```
GET /v1/projects/{projectId}/intermediates
鈫?{ characters: [...], scenes: [...], storyboard: [...], images: [...] }
```

---

## 3. API 濂戠害

### 3.1 涓�閿�鍒涗�?Job 鎻愪氦

```
POST /v1/orchestrator/jobs
Authorization: Bearer <JWT>
Content-Type: application/json

Request:
{
  "type": "one-click-manga",
  "payload": {
    "text": "澶忔棩鐨勫崍鍚庯紝鑻忔櫄鏅村湪澶у�﹀浘涔﹂�?..",
    "style": "anime-realistic",           // 椋庢牸棰勮�� key
    "aspectRatio": "16:9",                // 鐢诲箙
    "episodeCount": 3,                    // 闆嗘暟
    "language": "zh-CN"                   // 璇�瑷�
  },
  "projectId": "proj-abc123"              // optional: 鍏宠仈宸叉湁椤圭洰
}

Response 201:
{
  "jobId": "job-xyz789",
  "status": "queued",
  "type": "one-click-manga",
  "estimatedTime": 600,                    // 棰勪及绉掓暟
  "createdAt": 1718936100000
}

Error 400:
{
  "error": "VALIDATION_ERROR",
  "message": "text must be at least 100 characters",
  "code": "text_too_short"
}

Error 402:
{
  "error": "QUOTA_EXCEEDED",
  "message": "鏈�鏃ョ敓鎴愭�℃暟宸茬敤瀹?,
  "quotaReset": 1719000000000
}
```

### 3.2 Job 鐘舵�佹煡璇?
```
GET /v1/orchestrator/jobs/{jobId}
Authorization: Bearer <JWT>

Response 200:
{
  "jobId": "job-xyz789",
  "type": "one-click-manga",
  "status": "running",                     // queued | running | succeeded | failed
  "progress": 57,                          // 0-100
  "currentStep": 4,
  "totalSteps": 7,
  "steps": [
    { "step": 1, "name": "瑙掕壊鎻愬彇", "status": "completed", "previewUrl": "..." },
    { "step": 2, "name": "鍦烘櫙璁惧畾", "status": "completed", "previewUrl": "..." },
    { "step": 3, "name": "椋庢牸鍒嗘瀽", "status": "completed", "previewUrl": "..." },
    { "step": 4, "name": "鍒嗛暅鐢熸垚", "status": "running" },
    { "step": 5, "name": "鍥惧儚鐢熸垚", "status": "pending" },
    { "step": 6, "name": "瑙嗛�戠敓鎴�", "status": "pending" },
    { "step": 7, "name": "閰嶄箰鍚堟垚", "status": "pending" }
  ],
  "result": null,                          // succeeded 鏃跺～鍏?  "projectId": "proj-abc123",
  "createdAt": 1718936100000,
  "updatedAt": 1718936150000
}
```

### 3.3 WebSocket 杩涘害鎺ㄩ�?
```
WebSocket wss://api.qianji.work/ws/orchestrator/jobs/{jobId}
Authorization: Bearer <JWT> (鍦ㄨ繛鎺ユ椂閫氳繃 header 浼犻�?

娑堟伅鏍煎紡:

// 姝ラ�ゅ畬鎴愪簨浠�
{
  "type": "step-completed",
  "jobId": "job-xyz789",
  "step": 4,
  "stepName": "鍒嗛暅鐢熸垚",
  "progress": 57,
  "previewUrl": "https://cdn.qianji.work/previews/job-xyz789/step4-preview.jpg",
  "timestamp": 1718936150000
}

// 姝ラ�ゅけ璐ヤ簨浠�
{
  "type": "step-failed",
  "jobId": "job-xyz789",
  "step": 5,
  "stepName": "鍥惧儚鐢熸垚",
  "error": "AI 鏈嶅姟鏆傛椂涓嶅彲鐢�锛屽凡鑷�鍔ㄩ噸璇?,
  "retryable": true,
  "timestamp": 1718936200000
}

// Job 瀹屾垚浜嬩欢
{
  "type": "job-completed",
  "jobId": "job-xyz789",
  "result": {
    "videoUrl": "https://cdn.qianji.work/output/job-xyz789/output.mp4",
    "duration": 90,
    "projectId": "proj-abc123",
    "costEstimate": { "tokens": 50000, "images": 20, "videos": 3 }
  },
  "timestamp": 1718936700000
}

// Job 澶辫触浜嬩欢
{
  "type": "job-failed",
  "jobId": "job-xyz789",
  "error": "閰嶉�濅笉瓒筹紝鏃犳硶瀹屾垚鍥惧儚鐢熸�?,
  "failedStep": 5,
  "timestamp": 1718936200000
}
```

### 3.4 鐢ㄦ埛鍋忓ソ淇濆瓨

```
PUT /v1/users/me/preferences
Authorization: Bearer <JWT>
Content-Type: application/json

Request:
{
  "mangaEditorMode": "pro"         // "simple" | "pro"
}

Response 200:
{
  "mangaEditorMode": "pro"
}
```

### 3.5 椤圭洰涓�闂翠骇鐗╂煡璇�

```
GET /v1/projects/{projectId}/intermediates
Authorization: Bearer <JWT>

Response 200:
{
  "projectId": "proj-abc123",
  "characters": [
    { "id": "char-1", "name": "鑻忔櫄鏅?, "imageUrl": "...", "traits": ["娓╂煍", "鍥烘墽"] }
  ],
  "scenes": [
    { "id": "scene-1", "title": "鍥句功棣嗛倐閫?, "description": "..." }
  ],
  "storyboard": [
    { "shotId": "shot-1", "imageUrl": "...", "prompt": "...", "duration": 5 }
  ]
}
```

---

## 4. 缁勪欢鏍戜笌鏁版嵁娴?
### 4.1 瀹屾暣缁勪欢鏍?
```
MainLayout.vue (immersive)
鈹斺攢鈹� <router-view>
    鈹斺攢鈹� CreateMangaEntry.vue                     [鏂板�瀅 鍏ュ彛缁勪欢
        鈹?        鈹溾攢鈹� ModeSwitcher.vue                     [鏂板�瀅 妯″紡鍒囨崲
        鈹?  props: { mode: 'simple'|'pro' }
        鈹?  emits: ['update:mode']
        鈹?        鈹溾攢鈹� <template v-if="mode === 'simple'">
        鈹?  鈹斺攢鈹� OneClickEntry.vue                [鏂板�瀅 涓�閿�妯″紡瀹瑰�?        鈹?      鈹?        鈹?      鈹溾攢鈹� <template v-if="stage === 'input'">
        鈹?      鈹?  鈹斺攢鈹� OneClickInput.vue         [鏂板�瀅
        鈹?      鈹?      props: none
        鈹?      鈹?      emits: ['submit']
        鈹?      鈹?      浣跨敤: useCraftPrompt (澶嶇敤)
        鈹?      鈹?        鈹?      鈹溾攢鈹� <template v-if="stage === 'generating'">
        鈹?      鈹?  鈹斺攢鈹� OneClickProgress.vue      [鏂板�瀅
        鈹?      鈹?      props: { jobId, steps, currentStep, progress }
        鈹?      鈹?      浣跨敤: useWebSocket (澶嶇敤)
        鈹?      鈹?        鈹?      鈹斺攢鈹� <template v-if="stage === 'result'">
        鈹?          鈹斺攢鈹� OneClickResult.vue        [鏂板�瀅
        鈹?              props: { result }
        鈹?              emits: ['edit-in-pro', 'export']
        鈹?        鈹斺攢鈹� <template v-if="mode === 'pro'">
            鈹斺攢鈹� StoryboardEditorView.vue          [鐜版湁锛岄浂鏀瑰姩]
                鈹斺攢鈹� StoryboardStep5Music.vue      [鐜版湁]
```

### 4.2 Store 鎵╁睍

```typescript
// stores/oneClick.ts (鏂板��)
export const useOneClickStore = defineStore('oneClick', () => {
  const jobId = ref<string | null>(null)
  const stage = ref<'input' | 'generating' | 'result'>('input')
  const progress = ref(0)           // 0-100
  const currentStep = ref(0)        // 0-7
  const steps = ref<StepState[]>([])
  const result = ref<JobResult | null>(null)
  const ws = ref<WebSocket | null>(null)
  
  // 杩炴帴 WebSocket锛岃�㈤�?job 杩涘害
  function subscribe(jobId: string) { /* ... */ }
  
  // 鏂�寮�
  function unsubscribe() { /* ... */ }
  
  // 鍒囨崲鍒颁笓涓氭ā寮忕紪杈?  function editInProMode(projectId: string, step: number) { /* ... */ }
  
  return { jobId, stage, progress, currentStep, steps, result, subscribe, unsubscribe, editInProMode }
})
```

### 4.3 鏁版嵁娴佹�昏��

```
                  鈹屸攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?                  鈹?         CreateMangaEntry.vue         鈹?                  鈹?                                     鈹?                  鈹? resolveMode() 鈫?'simple' | 'pro'    鈹?                  鈹? useUserPrefs() 鈫?GET /v1/users/me/  鈹?                  鈹斺攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?                            鈹?             鈹?                    mode=simple        mode=pro
                            鈹?             鈹?         鈹屸攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈻尖攢鈹�鈹?  鈹屸攢鈹�鈹�鈹�鈹�鈻尖攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?         鈹? OneClickEntry.vue  鈹?  鈹?StoryboardEditorView鈹?         鈹?                    鈹?  鈹?   (鐜版湁锛屼笉鏀?      鈹?         鈹? 鈶?杈撳叆鏂囨湰+閰嶇疆     鈹?  鈹斺攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?         鈹? 鈶?POST /jobs       鈹?         鈹? 鈶?WS 璁㈤槄杩涘害       鈹?         鈹? 鈶?灞曠ず缁撴灉          鈹?         鈹? 鈶?瀵煎嚭/杞�涓撲�?      鈹?         鈹斺攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?                   鈹?          鈹屸攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈻尖攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?          鈹?ai-orchestrator 鈹?          鈹?  :8088         鈹?          鈹?                鈹?          鈹? one-click-manga鈹?          鈹? Pipeline       鈹?          鈹? (7姝ヨ嚜鍔?       鈹?          鈹斺攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?              鈹?  鈹?  鈹?    鈹屸攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈻尖攼 鈹屸柤鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?鈹屸柤鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?    鈹俛i-router 鈹?鈹俛sset-  鈹?鈹俻roject-   鈹?    鈹?:8083    鈹?鈹俿ervice 鈹?鈹俿ervice    鈹?    鈹?         鈹?鈹?:8085  鈹?鈹?:8087     鈹?    鈹?/chat    鈹?鈹?瀛樺偍    鈹?鈹?椤圭洰/浜х墿  鈹?    鈹?/image   鈹?鈹?       鈹?鈹?          鈹?    鈹?/video   鈹?鈹斺攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?鈹斺攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?    鈹?/audio   鈹?    鈹斺攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?```

---

## 5. P2 娲惧崟寤鸿��

### 5.1 娲惧崟浼樺厛绾т笌渚濊禆

```
Phase A (骞惰�岋紝鏃犱緷璧�)              Phase B (Phase A 瀹屾垚鍚?
鈹屸攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?     鈹屸攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?鈹?鏋楁煋 A1: Import 瑙勮寖缁熶竴    鈹?     鈹?鏋楁煋 B1: 涓�閿�妯″紡鍓嶇��缁勪欢寮�鍙?  鈹?鈹?鏋楁煋 A2: MangaLandingView  鈹?     鈹?  渚濊禆: A1, A2, 璋㈡搸 B3       鈹?鈹?         鏀归�犱负鍏ュ彛缁勪欢      鈹?鈹�鈹�鈹�鈫?鈹?                             鈹?鈹?璋㈡搸 A3: 鍚庣�� Pipeline 寮�鍙?鈹?     鈹?璋㈡搸 B2: WS 杩涘害鎺ㄩ�?+ Job闀块摼 鈹?鈹?璋㈡搸 A4: 鐢ㄦ埛鍋忓ソ API      鈹?     鈹?  渚濊禆: A3                    鈹?鈹斺攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?     鈹?璋㈡搸 B3: 涓�闂翠骇鐗╂煡璇� API      鈹?                                    鈹?  渚濊禆: A3                    鈹?                                    鈹?                             鈹?Phase C (Phase B 瀹屾垚鍚?           鈹斺攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?鈹屸攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?鈹?鏋楁煋 C1: 妯″紡鍒囨崲鑱旇皟         鈹?鈹?鏋楁煋 C2: 涓�閿�杞�涓撲笟鏁版嵁浼犻�?   鈹?鈹?鍗�宄� C3: 涓�閿�妯″�?E2E 娴嬭瘯    鈹?鈹?绾�寮� C4: API 濂戠害娴嬭瘯         鈹?鈹斺攢鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?```

### 5.2 鏋楁煋锛堝墠绔�锛夊伐浣滄竻鍗�

| 缂栧彿 | 浠诲姟 | 鏂囦欢 | 宸ヤ綔閲?| 浼樺厛绾?| 澶囨敞 |
|------|------|------|--------|--------|------|
| A1 | Import 璺�寰勭粺涓� | 6涓�鏂囦欢锛堣�伮?.3锛?| 0.5澶?| P0 | `../../` 鈫?`@/` |
| A2 | MangaLandingView 鏀归�?| `MangaLandingView.vue` | 1澶?| P0 | 鍓ョ�� mock 鏁版嵁锛岀簿绠�涓哄叆鍙ｉ〉 |
| B1.1 | CreateMangaEntry.vue | 鏂板�� | 0.5澶?| P0 | 妯″紡璺�鐢卞叆鍙� |
| B1.2 | ModeSwitcher.vue | 鏂板�� | 0.3澶?| P0 | 妯″紡鍒囨崲鎸夐挳缁?|
| B1.3 | OneClickEntry.vue | 鏂板�� | 0.5澶?| P0 | 涓�閿�妯″紡瀹瑰�?|
| B1.4 | OneClickInput.vue | 鏂板�� | 0.5澶?| P1 | 鏂囨湰杈撳叆 + 閰嶇疆闈㈡澘 |
| B1.5 | OneClickProgress.vue | 鏂板�� | 0.5澶?| P1 | 杩涘害鏉?+ WS 璁㈤槄 |
| B1.6 | OneClickResult.vue | 鏂板�� | 0.3澶?| P1 | 缁撴灉灞曠ず + 瀵煎嚭 |
| B1.7 | useOneClickStore | 鏂板�� | 0.5澶?| P1 | 鐘舵�佺�＄�?store |
| C1 | 璺�鐢遍厤缃�鏇存柊 | `router/index.ts` | 0.2澶?| P0 | `/create/animation` 鈫?CreateMangaEntry |
| C2 | 涓�閿�鈫掍笓涓氭暟鎹�浼犻�?| `OneClickResult.vue` + `StoryboardEditorView.vue` | 0.3澶?| P1 | 涓�闂翠骇鐗╁姞杞� |

**鏋楁煋鎬讳及**: 绾?5 浜哄ぉ

### 5.3 璋㈡搸锛堝悗绔�锛夊伐浣滄竻鍗�

| 缂栧彿 | 浠诲姟 | 鏂囦欢 | 宸ヤ綔閲?| 浼樺厛绾?| 澶囨敞 |
|------|------|------|--------|--------|------|
| A3.1 | one-click-manga Pipeline | `pipelines/one-click-manga.ts` (鏂板��) | 2澶?| P0 | 鏍稿績锛氫覆鑱旂幇鏈?涓?pipeline |
| A3.2 | Pipeline 娉ㄥ唽 | `pipelines/registry.ts` | 0.1澶?| P0 | 娉ㄥ唽鏂?type |
| A3.3 | auto-music 瀛?pipeline | `pipelines/auto-music.ts` (鏂板��) | 0.5澶?| P1 | 璋冪敤 ai-router /audio |
| A4 | 鐢ㄦ埛鍋忓ソ API | `user-service` (鏂板�� endpoint) | 0.5澶?| P1 | PUT /v1/users/me/preferences |
| B2.1 | WebSocket 杩涘害鎺ㄩ�?| `orchestrator-server.ts` | 1澶?| P0 | 姣忔�ュ畬鎴� push 杩涘害浜嬩欢 |
| B2.2 | Job 鐘舵�佸�炲�?| `orchestrator-server.ts` | 0.5澶?| P0 | Job 澧炲姞 steps[] 瀛楁�� |
| B3 | 涓�闂翠骇鐗╂煡璇� API | `project-service` (鏂板�� endpoint) | 1澶?| P1 | GET /v1/projects/{id}/intermediates |

**璋㈡搸鎬讳及**: 绾?5.6 浜哄ぉ

### 5.4 渚濊禆鍏崇郴鍥?
```
A1 (Import瑙勮寖) 鈹�鈹�鈹�鈹�鈹�鈹?                      鈹溾攢鈹�> B1 (涓�閿�鍓嶇��缁勪�? 鈹�鈹�> C1 (鑱旇皟) 鈹�鈹�> C3 (E2E)
A2 (MV鏀归�? 鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?                                     鈹�鈹�> C4 (API娴嬭瘯)
                  
A3 (Pipeline) 鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?                      鈹溾攢鈹�> B2 (WS杩涘害) 
A4 (鍋忓ソAPI) 鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹�鈹?    B3 (涓�闂翠骇鐗�) 
```

### 5.5 寤鸿��娲惧崟椤哄簭

1. **鍏堟淳璋㈡搸 A3**锛?澶╋紝鏍稿績 Pipeline锛夆�?杩欐槸鍏ㄩ摼璺�鐡堕�堬紝蹇呴』鍏堝姩
2. **鍚屾椂娲炬灄鏌?A1+A2**锛?.5澶╋級鈥?涓庡悗绔�骞惰�岋紝鏃犱緷璧?3. **A3 瀹屾垚鍚?* 鈫?璋㈡搸 B2+B3锛?澶╋級 + 鏋楁煋 B1 鍏ㄧ郴鍒楋紙2.6澶╋級骞惰��
4. **B 鍏ㄩ儴瀹屾垚鍚?* 鈫?鏋楁煋 C1+C2锛?.5澶╋級 + 鍗�宄� C3 + 绾�寮� C4锛堝叡1澶╋級

**鎬诲伐鏈?*: 绾?5 涓�宸ヤ綔鏃ワ紙鍓嶇�?5澶?+ 鍚庣�� 5.6澶╋紝骞惰�屽�?5澶╋級

### 5.6 椋庨櫓鎻愮ず

| 椋庨櫓 | 褰卞搷 | 缂撹В |
|------|------|------|
| ai-orchestrator 鍗曞疄渚嬪唴瀛樹綔涓氳〃 | 閲嶅惎涓�浣滀�?| P2 鍙�鎺ュ彈锛堜竴閿�妯″紡閫傚悎鍗崇敤鍗宠蛋锛夛紝P3 杩佺Щ鍒?Redis |
| MangaLandingView 涓?StoryboardEditorView 鍔熻兘閲嶅彔 | 浠ｇ爜娣蜂贡 | P2 鏄庣‘鍒嗗伐锛歁V=鍏ュ彛, SEV=涓撲笟缂栬緫鍣?|
| 鐜版湁 Pipeline 闂磋緭鍏ヨ緭鍑烘牸寮忎笉缁熶竴 | 涓茶仈鎶ラ敊 | A3 寮�鍙戞椂缁熶竴涓�闂翠骇鐗� Schema |
| 涓�閿�妯″�?5-15 鍒嗛挓鑰楁椂 | 鐢ㄦ埛鐒﹁檻 | WS 鎺ㄩ�佸綋鍓嶆�ラ�?瀹炴椂棰勮�堢缉鐣ュ�?|

---

## 6. 鍙樻洿璁板綍

| 鐗堟湰 | 鏃ユ湡 | 鍙樻洿 | 浣滆�?|
|------|------|------|------|
| v1.0 | 2026-06-21 | 鍒濈増锛氱紪杈戝櫒瀹¤�� + 涓�閿�妯″紡鏋舵�?+ P2 娲惧崟寤鸿�� | 绋嬫瀯 |
