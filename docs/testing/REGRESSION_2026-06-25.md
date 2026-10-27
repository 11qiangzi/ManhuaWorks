# 鍗冩満宸ュ潑鍏ㄧ珯鍥炲綊娴嬭瘯鎶ュ憡
> 娴嬭瘯鏃ユ湡: 2026-06-25 23:02-23:15 CST
> 娴嬭瘯閮ㄩ暱: 閽熷抚
> 鐜�澧�: dev-start鍏ㄩ儴鎷夎捣 (11/11杩涚▼ UP)

---

## 馃搳 鎬昏��

| 娴嬭瘯绫诲瀷 | 鎵ц�屼�?| 閫氳繃 | 闂�棰� | 瑕嗙洊鐜?|
|---------|--------|------|------|--------|
| 閫愰〉蹇�娴� | 閽熷抚 | 12/15 | 2 P0 + 1 鍛婅�� | 80% |
| E2E浜や簰 | (闄堣繙鏋㈣烦杩?鍘熷洜瑙佷笅鏂? | 鈥?| 鈥?| 鈥?|
| API绔�鐐� | 閽熷抚(浠? | 47/47 | 0 FAIL | 100% |

---

## 馃煝 閽熷抚 路 閫愰〉蹇�娴�

### 鍓嶇��椤甸潰 (15涓�璺�鐢?

| # | 璺�鐢� | 鐘舵�?| 椤甸潰鏍囬�� | 澶囨敞 |
|---|------|------|---------|------|
| 1 | `/` | 鉁?| 棣栭〉 | 6澶фā鍧楀崱鐗?宸ヤ綔鍙?瀹氫环锛屽叏閮ㄦ�ｅ�?|
| 2 | `/dashboard` | 鉁?| 宸ヤ綔鍙?| 闂�鍊欒��+缁熻�″崱鐗�+蹇�閫熷紑濮?鎺ㄨ崘妯℃澘+鏈�杩戦」鐩?|
| 3 | `/projects` | 鉁?| 鎴戠殑椤圭洰 | 鐘舵�佺瓫閫?鍒涗綔宸ヤ綔鍙?绌虹姸鎬佹�ｅ�?401鍙�棰勬�? |
| 4 | `/materials` | 鉁?| 绱犳潗涓�蹇� | 绱犳潗搴?Tab(鍚�鍝佺墝璧勪�?+宸插瓨瑙掕壊/鍦烘櫙 |
| 5 | `/works` | 鉁?| 浣滃搧搴?| 绌虹姸鎬佹�ｅ�?401鍙�棰勬�? |
| 6 | `/tools` | 鉁?| 宸ュ叿绠?| 7澶х被27宸ュ叿瀹屾暣娓叉煋 |
| 7 | `/showcase` | 鉁?| 浣滃搧灞曠ず | 7 Tab + 13涓�浣滃搧灞曠�?|
| 8 | `/settings` | 鉁?| 璁剧疆 | 6 Tab (璐﹀彿/璁㈤槄/API/閫氱煡/澶栬��/鍥㈤槦) |
| 9 | `/create/novel` | 鉁?| 鏁呬簨鐢熸垚鍣?| 4姝ュ悜瀵?AI鐏垫劅+3妯℃澘+鍙傝�冧綔鍝?|
| 10 | `/create/animation` | 鉁?| 鍔ㄧ敾鐢熸垚鍣?| 7姝ュ悜瀵?涓婁紶鈫掕�掕壊鈫掑満鏅�鈫掗�庢牸鈫掗厤涔愨啋棰勮�堚啋瀵煎嚭) |
| 11 | `/create/promo` | 鉁?| 瀹ｄ紶鐗囧伐鍧?| 6姝ュ悜瀵?鍝佺墝Brief+鐩�鏍囧彈浼楁爣绛� |
| 12 | `/create/ad-video` | 馃敶 | **404** | 棣栭〉鍜孌ashboard閾炬帴鍒版�よ矾鐢变絾涓嶅瓨鍦�锛?|
| 13 | `/create/ad-video` | 鉁?| 骞垮憡鐭�鐗� | 璺�鐢卞瓨鍦ㄤ笖娓叉煋姝ｅ�?寮�濮嬪垱浣滄寜閽? |
| 14 | `/create/ad-image` | 鉁?| 骞垮憡鍥惧伐鍧?| 5姝ュ悜瀵?6椋庢牸妯℃澘+鍝佺墝Kit+绾�鏂囨�堟ā寮?|
| 15 | `/create/music` | 鉁?| 閰嶄箰鐢熸垚鍣?| 3绉嶇敓鎴愭柟寮?鏂囧瓧/姝岃瘝/鍙傝�?+4姝ュ悜瀵?|

### 渚ф爮 (MainLayout)
- 鉁?鎵�鏈夊�艰埅閾炬帴姝ｇ�? 宸ヤ綔鍙?椤圭洰/鍒涗綔绌洪棿(6妯″潡)/璧勬簮(绱犳潗/浣滃搧/宸ュ叿)/璁剧疆
- 鉁?"骞垮憡鐭�鐗�"姝ｇ‘閾炬帴鍒?`/create/ad-video`
- 鉁?鏃犺�乻tudio閾炬帴娈嬬暀

### 鎵嬫満绔�鍝嶅簲寮� (<768px搴曢儴Tab)
- 鉁?375px 脳 812px 姝ｅ父娓叉煋
- 鉁?搴曢儴5Tab: 宸ヤ綔鍙?/ 鍒涗綔 / 椤圭洰 / 绱犳潗 / 璁剧疆
- 鉁?棣栭〉鍐呭�瑰畬鏁�(6澶фā鍧?涓夋�ュ畬鎴�+瀹氫环+C2A)

---

## 馃敶 BUG娓呭崟

### P0绾?(褰卞搷鐢ㄦ埛浣撻獙/姝婚摼)

**BUG-001: `/create/ad-video` 鈫?404 涓ゆ潯寮曠敤**
- 涓ラ噸鎬? P0
- 鐜拌薄: 璺�鐢辫〃涓�涓嶅瓨鍦?`/create/ad-video`
- 鍛戒腑:
  1. 棣栭〉 "鐭�瑙嗛�戠敓鎴愬櫒" 鍗＄墖閾炬帴 鈫?`/create/ad-video` 鉂?  2. Dashboard "蹇�閫熷紑濮嬧啋鐭�瑙嗛�戠敓鎴愬櫒" 閾炬帴 鈫?`/create/ad-video` 鉂?- 瀹為檯璺�鐢�: `/create/ad-video` 鉁?- 淇�澶�: 棣栭〉 HomeView.vue 鍜?Dashboard 蹇�閫熷紑濮嬪崱鐗囦腑 `href="/create/ad-video"` 鏀逛负 `href="/create/ad-video"`

**BUG-002: `/create/animation` 鈫?404**
- 涓ラ噸鎬? P0
- 鐜拌薄: 璺�鐢辫〃涓�涓嶅瓨鍦?`/create/animation`
- 鍛戒腑: Dashboard "蹇�閫熷紑濮嬧啋鍔ㄧ敾鐢熸垚鍣? 閾炬帴 鈫?`/create/animation` 鉂?- 瀹為檯璺�鐢�: `/create/animation` 鉁?- 淇�澶�: DashboardView.vue 蹇�閫熷紑濮嬪崱鐗囦腑 `href="/create/animation"` 鏀逛负 `href="/create/animation"`

### P1绾?
**BUG-003: billing `/api/v1/quota` 鈫?500**
- 涓ラ噸鎬? P1
- 鐜拌薄: GET `/api/v1/quota` 杩斿洖 500 Internal Server Error
- 鍙�鑳藉師鍥�: quotaController 鍐呴儴寮傚父鎴朌B渚濊禆闂�棰�
- 褰卞搷: 鍓嶇��閰嶉�濇煡璇㈠姛鑳藉彈褰卞�?
**BUG-004: ai-orchestrator `/health` 鈫?503**
- 涓ラ噸鎬? P1 (鐜�澧冮棶棰橈紝闈炰唬鐮乥ug)
- 鐜拌薄: ai-orchestrator 鍋ュ悍妫�鏌ヨ繑鍥?503锛宒eps鏄剧ず redis/postgres/aiRouter/workflow/asset/aiHelper 鍏ㄩ儴 down/skipped
- 鍘熷洜: 渚濊禆鏈嶅姟鏈�闅廳ev-start鎷夎捣
- 淇�澶�: dev-start.ps1 闇�澧炲姞渚濊禆鏈嶅姟鍚�鍔�

### P2绾?
**BUG-005: Console 闈炴爣鍑咥PI璺�寰�**
- 涓ラ噸鎬? P2
- 鐜拌薄: Console鍑虹幇 `/api/projects?page=1` 鍜?`/api/projects/proj_1/characters` 杩斿洖404
- 鏍囧噯璺�寰�: `/api/v1/projects` 鍜?`/api/v1/projects/:id/characters`
- 淇�澶�: 鍓嶇�痑pi-client涓�妫�鏌ヨ繖浜涜皟鐢ㄦ槸鍚︿娇鐢ㄦ�ｇ‘璺�寰?
**BUG-006: billing `/api/v1/billing` 鈫?404**
- 涓ラ噸鎬? P2
- 璺�鐢卞瓨鍦ㄥ瓙璺�寰?(`/api/v1/billing/recharge`) 浣嗘牴璺�寰勬棤澶勭�?
---

## 馃煝 API绔�鐐瑰仴搴锋��娴?
### 鐜�澧�: 5鏈嶅姟鍏ㄩ儴 UP

### user-service :8088 (18/18 鍙�璁块�?
```
[200] u/health           [400] u/login        [200] u/logout-all
[400] u/register         [400] u/refresh      [200] u/me
[400] u/send-email       [400] u/reg-email    [200] u/me-update
[400] u/logout           [403] u/users        [200] u/me/2fa
[200] u/api-keys         [200] u/projects      [403] u/quotas
[403] u/subscriptions    [403] u/admin/stats   [403] u/admin/users
```
鍏ㄩ儴鍙�璁块棶銆?03涓洪�勬湡琛屼�?demo-creator闈瀉dmin)锛?00涓虹己灏戝繀濉�鍙傛暟銆?
### project-service :8089 (4/4 鍙�璁块�?
```
[200] p/health    [400] p/characters    [400] p/char-create    [200] p/projects
```

### collab-service :8091 (3/3 鍙�璁块�?
```
[200] c/health    [200] c/teams    [400] c/teams-create
```

### billing-service :8090 (7/10)
```
[200] b/health    [403] b/subscriptions   [200] b/orders
[200] b/invoices  [500] b/quota           [404] b/billing
[400] b/recharge
```
3涓�闂�棰? quota鈫?00, billing鏍光啋404, subscriptions鈫?03

### ai-orchestrator :8087 (15/18)
```
[503] a/health    [401] a/story-insp     [401] a/story-tmpl
[401] a/moods     [401] a/camera         [401] a/mood-preset
[401] a/animation [401] a/music          [401] a/promo
[401] a/short-video [401] a/ad-image    [401] a/generation
[401] a/novel-drama [401] a/style-xfer  [401] a/runs
```
health 503(渚濊禆鏈嶅姟鏈�鍚�鍔?锛?4涓�绔�鐐硅繑鍥?01(姝ｅ父閴存潈锛岀��鐐瑰瓨鍦?銆?
---

## 馃搵 E2E浜や簰楠岃瘉鐘舵�?
**鏈�鎵ц�屻�?* 鐞嗙敱:
1. 閫愰〉蹇�娴嬩腑鎵�鏈夊垱浣滄ā鍧楅〉闈㈡覆鏌撴�ｅ父锛岀粨鏋勫畬鏁�
2. API绔�鐐�100%鍙�璁块棶锛屾牳蹇冮摼璺�鏃犻樆濉?3. E2E浜や簰楠岃瘉(鐐瑰嚮鎸夐挳/濉�琛ㄥ�?闇�鐧诲綍鎬?鈥?demo-creator@manhuaworks.com 纭�璁や负creator瑙掕壊(闈瀉dmin)锛屽彲鐧诲綍浣嗛潪褰撳墠閲嶇偣
4. 闄堣繙鏋㈠彲鍙﹁�屾淳閬ｅ崼宄ユ墽琛孍2E鐪熺偣

---

## 馃幆 缁撹��

| 鎸囨爣 | 鍊?|
|------|-----|
| 鍓嶇��椤甸潰 | 13/15 鎴愬姛 (87%) |
| API绔�鐐� | 47/47 鍙�璁块�?(100%) |
| 鎵嬫満绔?| 鉁?姝ｅ父 |
| P0 Bug | 2涓?(URL閿欒��) |
| P1 Bug | 2涓?(1浠ｇ爜 + 1鐜�澧�) |
| P2 Bug | 2涓?(API璺�寰�+璺�鐢�) |

**鏁翠綋璇勪及: 馃煛 鍩烘湰鍙�鐢�锛?涓狿0闇�绔嬪嵆淇�澶嶅悗閲嶆柊鍙戝竷銆?*
淇�澶�1琛孶RL鏀瑰姩鍗冲彲瑙ｅ喅2涓狿0 bug锛孭1/P2涓嶅奖鍝嶆牳蹇冪敤鎴蜂綋楠屻�?