/**
 * ENH-7: 短视频脚本模板 Prompt
 *
 * 派单53：谢擎 | 日期：2026-06-25
 *
 * 返回6-8个预置短视频脚本模板（名称+结构+适用品类+示例脚本）
 */

import type {
  ScriptTemplate,
  ScriptTemplateListResponse,
} from "../routes/types.js";

/**
 * ENH-7: 6个预置短视频脚本模板
 *
 * 按电商短视频成熟套路编排，覆盖6大品类场景
 */
export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: "pain-point-solution",
    name: "痛点解决型",
    description: "先展示用户痛点→产品出现→解决问题→效果对比→下单引导",
    structure: ["痛点引入（3-5秒）", "产品亮相（2-3秒）", "解决方案演示（8-12秒）", "效果对比（5-8秒）", "CTA下单引导（3-5秒）"],
    suitableCategories: ["美妆护肤", "家居日用", "个护清洁", "健康保健"],
    estimatedDuration: "20-30秒",
    exampleScript: {
      title: "熬夜党必囤！这款眼霜真的能打",
      scenes: [
        { time: "0-3s", action: "特写黑眼圈+疲惫表情", text: "凌晨两点还在刷手机的你...", visual: "暗光环境，手机屏幕反光" },
        { time: "3-6s", action: "产品快速切入画面", text: "试试这个熬夜急救眼霜", visual: "产品特写+质地展示" },
        { time: "6-18s", action: "上脸使用对比", text: "轻薄吸收快，不油腻不搓泥", visual: "Before/After分屏对比" },
        { time: "18-25s", action: "真人出镜分享感受", text: "用了一周，眼周真的亮了", visual: "自然光下真人展示" },
        { time: "25-30s", action: "价格+下单引导", text: "现在下单立减30，手慢无", visual: "价格标签+购物车按钮" }
      ],
      tips: "前3秒用痛点场景抓注意力，中间用对比建立信任，结尾紧迫感促单"
    }
  },
  {
    id: "unboxing-review",
    name: "开箱展示型",
    description: "拆箱→细节特写→亮点突出→使用场景→种草推荐",
    structure: ["拆箱过程（3-5秒）", "细节特写（5-8秒）", "核心亮点（5-8秒）", "使用场景展示（5-8秒）", "种草总结（3-5秒）"],
    suitableCategories: ["3C数码", "创意礼品", "潮流服饰", "食品饮料"],
    estimatedDuration: "20-30秒",
    exampleScript: {
      title: "开箱！年度最值得入的蓝牙耳机",
      scenes: [
        { time: "0-3s", action: "撕包装/开箱动作", text: "期待已久的耳机终于到了！", visual: "开箱第一人称视角" },
        { time: "3-8s", action: "耳机外观360度展示", text: "这个质感，拿到手才知道多高级", visual: "产品旋转特写，光线折射" },
        { time: "8-16s", action: "核心功能演示", text: "降噪模式一开，整个世界安静了", visual: "降噪开关动画+环境音对比" },
        { time: "16-25s", action: "佩戴使用场景", text: "通勤/健身/办公全场景适用", visual: "多场景快速切换" },
        { time: "25-30s", action: "总结推荐", text: "这个价位，这个品质，闭眼入", visual: "产品+价格+购买链接重叠" }
      ],
      tips: "拆箱的真实感最重要，细节特写要在光线好的环境下拍，多用微距镜头"
    }
  },
  {
    id: "word-of-mouth",
    name: "口播种草型",
    description: "真人出镜→使用分享→细节讲解→情感连接→真诚推荐",
    structure: ["引起注意（3秒）", "真实分享（8-12秒）", "细节讲解（5-8秒）", "情感共鸣（3-5秒）", "推荐话术（3-5秒）"],
    suitableCategories: ["美妆护肤", "母婴用品", "个护清洁", "美食探店"],
    estimatedDuration: "25-35秒",
    exampleScript: {
      title: "连用三支的口红，素颜也能hold住",
      scenes: [
        { time: "0-3s", action: "直接上嘴试色", text: "这支口红我连用了三支", visual: "嘴巴特写+产品" },
        { time: "3-15s", action: "真人分享使用体验", text: "素颜涂也好看，质地丝滑不拔干", visual: "自然光下真人出镜，半身" },
        { time: "15-22s", action: "多色号/场景展示", text: "日常通勤用这支，约会用这支", visual: "多色号手臂试色对比" },
        { time: "22-28s", action: "真实感受，情感连接", text: "真的，女生买口红不就图个提气色吗", visual: "微笑镜头特写" },
        { time: "28-33s", action: "真诚推荐+链接", text: "这个价格真的很良心了，链接放评论区", visual: "产品+评论区指引" }
      ],
      tips: "小红书/抖音口播风格，真实感>专业度，声音要有亲和力，不要念稿感"
    }
  },
  {
    id: "comparison-test",
    name: "对比测评型",
    description: "提出对比问题→A款展示→B款展示→核心差异→结论推荐",
    structure: ["抛问题（3秒）", "A款展示（5-8秒）", "B款展示（5-8秒）", "核心差异对比（5-8秒）", "结论+推荐（3-5秒）"],
    suitableCategories: ["3C数码", "家电", "汽车用品", "运动户外"],
    estimatedDuration: "20-30秒",
    exampleScript: {
      title: "100块 vs 1000块吹风机，差在哪？",
      scenes: [
        { time: "0-3s", action: "两款产品同时入镜", text: "100块和1000块的吹风机，到底差在哪？", visual: "双产品并列" },
        { time: "3-10s", action: "A款快速演示", text: "百元款：风速OK但温度不太稳定", visual: "A款使用画面+参数标注" },
        { time: "10-17s", action: "B款快速演示", text: "千元款：负离子+智能温控+轻量化", visual: "B款使用画面+参数标注" },
        { time: "17-25s", action: "关键差异放大对比", text: "发质差别的直接原因是负离子和温控", visual: "Split-screen效果对比" },
        { time: "25-30s", action: "结论推荐", text: "预算够直接上千元款，平替我也放评论区了", visual: "两款产品+价格+推荐标识" }
      ],
      tips: "对比要公平客观，不要恶意贬低竞品，差异用事实说话"
    }
  },
  {
    id: "scenario-sketch",
    name: "场景短剧型",
    description: "生活场景→痛点搞笑演绎→产品神转场→使用效果→反转收尾",
    structure: ["场景引入（3-5秒）", "痛点搞笑演绎（5-8秒）", "产品神转场（2-3秒）", "使用效果（5-8秒）", "反转/梗收尾（3-5秒）"],
    suitableCategories: ["家居日用", "食品饮料", "创意小物", "生活服务"],
    estimatedDuration: "25-35秒",
    exampleScript: {
      title: "当闺蜜来我家看到了这个...",
      scenes: [
        { time: "0-5s", action: "日常尬场景", text: "闺蜜来访，家里乱七八糟...", visual: "凌乱客厅全景" },
        { time: "5-12s", action: "闺蜜嫌弃表情+吐槽", text: "\"你家是刚被炸过吗？\"", visual: "闺蜜夸张表情特写" },
        { time: "12-15s", action: "产品神转场", text: "\"让你看看什么叫收纳神器\"", visual: "产品魔法登场+BGM切换" },
        { time: "15-25s", action: "快速收纳演示", text: "10秒搞定，焕然一新", visual: "快速收拾的时间压缩效果" },
        { time: "25-32s", action: "闺蜜惊叹反转", text: "\"...链接发我，立刻马上\"", visual: "闺蜜态度180度转弯+产品特写" }
      ],
      tips: "剧情要夸张但不假，转场要干净利落，结尾的反转/梗是记忆点，配乐要配合情绪"
    }
  },
  {
    id: "fast-pace-montage",
    name: "快节奏混剪型",
    description: "快速画面切换→产品多角度展示→无旁白纯视觉→卡点配乐→LOGO收尾",
    structure: ["钩子画面（1-2秒）", "快速混剪（10-15秒）", "高潮卡点（3-5秒）", "品牌露出（2-3秒）", "CTA（2-3秒）"],
    suitableCategories: ["潮流服饰", "运动户外", "美妆彩妆", "数码配件"],
    estimatedDuration: "15-25秒",
    exampleScript: {
      title: "这个夏天，就要出彩 🌈",
      scenes: [
        { time: "0-2s", action: "单色爆闪开场", text: "（无旁白）", visual: "产品高饱和特写爆闪" },
        { time: "2-15s", action: "多角度+多配色快速切换", text: "（无旁白，纯视觉+卡点BGM）", visual: "产品旋转/使用/穿搭快速混剪" },
        { time: "15-20s", action: "音乐高潮+慢动作卡点", text: "（无旁白）", visual: "产品slow-motion高潮画面" },
        { time: "20-23s", action: "LOGO+产品阵容", text: "夏天的颜色，你选哪个？", visual: "全系列配色排列+LOGO" },
        { time: "23-25s", action: "购买引导", text: "限时9折，评论区见", visual: "价格+二维码+店铺名" }
      ],
      tips: "画面节奏和BGM必须严格卡点，多配色产品最适合这个风格，色彩要饱满有冲击力"
    }
  }
];

/**
 * 获取模板列表（直接返回预置数据，不调AI）
 */
export function getScriptTemplates(): ScriptTemplateListResponse {
  return {
    templates: SCRIPT_TEMPLATES,
    total: SCRIPT_TEMPLATES.length,
    updatedAt: "2026-06-25",
    usageTip: "选择模板后，AI会基于模板结构生成定制脚本。也可以选择「不使用模板」让AI自由发挥。"
  };
}
