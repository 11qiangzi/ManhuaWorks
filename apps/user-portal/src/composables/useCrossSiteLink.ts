import { computed, type Ref, unref } from 'vue'





/**


 * useCrossSiteLink 闂備胶锟借�勫��?闂備焦鐪归崹濠氬窗閹版澘鍨傛慨妯挎硾缁犱即鏌涢妷鎴濆��閿熷�燂拷娴嬫�堥柟鍓ф嚀閸氬綊鏌ｅ┑鎾村�� (port 3000) 闂備椒绱�閹凤拷?URL闂備胶锟藉�嬪��? *


 * 闂備椒绱�閹风兘鏌曟繛鍨�锟芥�呮嚌閹�锟介湁闁绘ɑ鐓￠敓鑺ユ倐閺佹挻鎱ㄩ幇锟介悘锟介梺绯曟櫆閻╋拷鐎规洏鍎查幆鏃堝煡閸涳拷鐎氾拷?(user-portal, port 5180) 闂佽崵濮撮幖锟介柣銈呮搐闇夐柛鈩冪☉缁�鍡椢涙０浣猴拷渚�鎯佸�婂懐纾奸柡鍐挎嫹闁荤啙鍛�锟芥劙鏁撴禒瀣�绾ч柛锟介悢椋庝淮濠电偛鎳忕敮鐐靛垝閸�锟藉�板嫰骞囬埡瀣�瀚瑰�㈣埖鍔栭敓钘夊暣閺佹挻绂掔�ｏ拷杩�? * 濠电偠鎻�缂嶏拷婵炲�嬫礋瀵�锟介柨鐕傛嫹 window.location.hostname 闂備礁鎲￠弻锝夊礉瀹ュ�嬫櫢闁瑰瓨甯為崝宥夋煟鎼达拷閹风兘鎮楃喊澶嬪��?URL闂備焦瀵х粙鎴炵附閺冨倻绠斿�㈣泛鏈�閸忔粓鏌ㄩ悢鐑樻珪缂佽鲸鎹囧��浠嬫晸娴犲��鏅搁柨鐕傛嫹?localhost闂備胶锟藉�嬪��? *


 * @example


 * ```ts


 * const editUrl = useCrossSiteLink('/create/animation/' + projectId)


 * // => "http://myhost:3000/create/animation/abc123"


 *


 * // 濠电偞鍨跺�婂�氬窗閹版澘鏋侀柨鐔剁矙閺岀喖鏁撻敓锟�?ref / computed 闂備礁鎲￠悷銉╁磹瑜版帒姹查柨鐕傛嫹:


 * const url = useCrossSiteLink(computed(() => `/project/${id.value}`))


 * ```


 */


export function useCrossSiteLink(path: string | Ref<string>) {


  return computed(() => {


    const p = unref(path)


    const hostname = window.location.hostname


    return `http://${hostname}:3000${p.startsWith('/') ? '' : '/'}${p}`


  })


}





/**


 * Non-reactive helper for one-off URL generation outside of templates.


 *


 * @example


 * ```ts


 * window.open(buildCrossSiteUrl('/create/animation/' + id))


 * ```


 */


export function buildCrossSiteUrl(path: string): string {


  const hostname = window.location.hostname


  return `http://${hostname}:3000${path.startsWith('/') ? '' : '/'}${path}`


}


