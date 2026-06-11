// ManhuaWorks 微信小程序全局配置
// M2 脚手架: 4 tabBar (首页 / 项目 / 我的 / 设置), 仿 web 风格
// 真实后端接入留给 L5-B 阶段

import type { Config } from '@tarojs/taro'

/**
 * 设计令牌 (Design Tokens)
 * 仿 web 深色头/浅色底风格, 集中导出给所有页面 .vue 复用
 */
export interface ThemeTokens {
  primary: string
  primaryDark: string
  textPrimary: string
  textSecondary: string
  background: string
  surface: string
  border: string
  success: string
  danger: string
}

export const theme: ThemeTokens = {
  primary: '#0EA5E9',
  primaryDark: '#0F172A',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  success: '#10B981',
  danger: '#EF4444'
}

const config: Config = {
  pages: [
    'pages/index/index',
    'pages/me/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#0F172A',
    navigationBarTitleText: 'ManhuaWorks',
    navigationBarTextStyle: 'white',
    backgroundColor: '#F8FAFC'
  },
  tabBar: {
    color: '#64748B',
    selectedColor: '#0EA5E9',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/tabbar/home.png',
        selectedIconPath: 'assets/tabbar/home-active.png'
      },
      {
        pagePath: 'pages/projects/index',
        text: '项目',
        iconPath: 'assets/tabbar/project.png',
        selectedIconPath: 'assets/tabbar/project-active.png'
      },
      {
        pagePath: 'pages/me/index',
        text: '我的',
        iconPath: 'assets/tabbar/me.png',
        selectedIconPath: 'assets/tabbar/me-active.png'
      },
      {
        pagePath: 'pages/settings/index',
        text: '设置',
        iconPath: 'assets/tabbar/settings.png',
        selectedIconPath: 'assets/tabbar/settings-active.png'
      }
    ]
  },
  // 网络超时
  networkTimeout: {
    request: 10000,
    downloadFile: 20000
  },
  // 调试
  debug: true
}

export default config
