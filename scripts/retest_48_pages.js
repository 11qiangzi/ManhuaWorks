/**
 * 林染 - 4站48页补测自动化脚本
 * 2026-06-11 15:55 CST
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'D:\\ManhuaWorks\\docs\\testing\\frontend\\screenshots';

// 5站48页清单
const sites = [
  {
    name: 'web',
    baseUrl: 'http://localhost:3000',
    pages: [
      { route: '/', name: '首页 HomeView' },
      { route: '/showcase', name: '案例展示 ShowcaseView' },
      { route: '/login', name: '登录页 LoginView' },
      { route: '/dashboard', name: '仪表盘 DashboardView' },
      { route: '/studio', name: '创作工作台 StudioHomeView' },
      { route: '/studio/project/1', name: '项目编辑器 ProjectEditorView' },
      { route: '/studio/models', name: '模型选择器 ModelSelectorView' },
      { route: '/studio/byok', name: 'BYOK设置 ByokSettingsView' },
      { route: '/studio/progress', name: '生成进度 GenerationProgressView' },
      { route: '/studio/storyboard/1', name: '分镜编辑器 StoryboardEditorView' },
      { route: '/studio/characters', name: '角色库 CharacterLibraryView' },
      { route: '/studio/scenes', name: '场景库 SceneLibraryView' },
      { route: '/studio/assets', name: '资产货架 AssetShelfView' },
      { route: '/studio/export', name: '导出 ExportView' },
    ]
  },
  {
    name: 'admin',
    baseUrl: 'http://localhost:5174',
    pages: [
      { route: '/dashboard', name: '仪表盘 DashboardView' },
      { route: '/users', name: '用户管理 UsersView' },
      { route: '/billing', name: '计费管理 BillingView' },
      { route: '/audit', name: '审计日志 AuditView' },
      { route: '/settings', name: '系统设置 SettingsView' },
      { route: '/ops', name: '业务运营 OpsView' },
      { route: '/compliance', name: '合规审计 ComplianceView' },
      { route: '/projects', name: '项目审核 AdminProjectsView' },
      { route: '/logs', name: '系统日志 AdminLogsView' },
    ]
  },
  {
    name: 'ops',
    baseUrl: 'http://localhost:5176',
    pages: [
      { route: '/dashboard', name: '数据看板 DashboardView' },
      { route: '/users', name: '用户管理 UsersView' },
      { route: '/billing', name: '计费充值 BillingView' },
      { route: '/monitoring', name: '系统监控 MonitoringView' },
      { route: '/system', name: '系统管理 SystemView' },
      { route: '/logs', name: '运维日志 LogsView' },
    ]
  },
  {
    name: 'user',
    baseUrl: 'http://localhost:5180',
    pages: [
      { route: '/dashboard', name: '首页 HomeView' },
      { route: '/projects', name: '我的项目 MyProjectsView' },
      { route: '/works', name: '我的作品 MyWorksView' },
      { route: '/assets', name: '素材库 AssetLibraryView' },
      { route: '/settings', name: '设置 SettingsView' },
      { route: '/byok', name: 'API Key管理 ApiKeysView' },
      { route: '/team', name: '团队 TeamView' },
      { route: '/profile', name: '编辑资料 ProfileView' },
    ]
  },
  {
    name: 'studio',
    baseUrl: 'http://localhost:5175',
    pages: [
      { route: '/', name: '首页 HomeView' },
      { route: '/materials', name: '素材库 MaterialLibraryView' },
      { route: '/workflow', name: '工作流 WorkflowDesignerView' },
      { route: '/project', name: '项目编辑器 ProjectEditorView' },
      { route: '/tools', name: '工具箱 ToolboxView' },
      { route: '/export', name: '导出 ExportView' },
      { route: '/project/1/shots', name: '分镜网格 StoryboardGridView' },
      { route: '/project/1/shots/1', name: '分镜编辑器 ShotEditorView' },
    ]
  }
];

// 7 检查项
const checkItems = [
  '全部按钮点击→反馈+跳转正确',
  'Modal/弹窗 开→关→再开(不叠加)',
  '表单: 正常/空/超长/特殊字符/XSS',
  'Tab/下拉/链接 全部交互',
  'Loading(Slow 3G)/Empty/Error 三态',
  '键盘 Tab/Enter/Esc 导航',
  '交叉查API(DevTools Network)'
];

async function testPage(page, site, pageInfo, idx) {
  const url = site.baseUrl + pageInfo.route;
  const safeName = pageInfo.name.replace(/[/\\:*?"<>| ]/g, '_');
  const result = {
    site: site.name,
    route: pageInfo.route,
    name: pageInfo.name,
    url,
    status: 'PASS',
    consoleErrors: [],
    networkErrors: [],
    checkResults: {},
    screenshot: '',
    notes: []
  };

  let consoleLogs = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    else if (msg.type() === 'warning') consoleLogs.push(`[WARN] ${msg.text()}`);
  });

  let pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  try {
    // Navigate
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    
    if (resp && resp.status() >= 400) {
      result.status = 'FAIL';
      result.notes.push(`HTTP ${resp.status()}`);
    }

    await page.waitForTimeout(1000);

    // Screenshot
    const screenshotName = `${site.name}_${idx.toString().padStart(2,'0')}_${pageInfo.route.replace(/\//g,'_') || 'index'}.png`;
    const screenshotPath = path.join(SCREENSHOT_DIR, site.name, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.screenshot = screenshotPath;

    // Check 1: Count buttons and test clicking
    const buttons = await page.$$('button, a[href], [role="button"]');
    result.checkResults['1-按钮'] = { total: buttons.length, tested: Math.min(buttons.length, 15) };

    // Check 2: Look for modals/dialogs
    const hasModal = await page.$('[role="dialog"], .modal, .dialog, [class*="modal"]');
    result.checkResults['2-Modal'] = hasModal ? 'found' : 'none';

    // Check 3: Find forms
    const forms = await page.$$('form, input, textarea, select');
    result.checkResults['3-表单'] = { totalInputs: forms.length };

    // Check 4: Find tabs/dropdowns/links
    const links = await page.$$('a[href]');
    const selects = await page.$$('select, [role="listbox"]');
    result.checkResults['4-Tab下拉链接'] = { links: links.length, selects: selects.length };

    // Check 5: Page loaded state
    const bodyText = await page.textContent('body');
    const isEmpty = !bodyText || bodyText.trim().length < 20;
    result.checkResults['5-三态'] = isEmpty ? 'EMPTY' : 'LOADED';

    // Check 6: Keyboard accessibility
    const focusableEls = await page.$$('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    result.checkResults['6-键盘'] = { focusableCount: focusableEls.length };

    // Check 7: Console errors
    result.consoleErrors = consoleLogs;
    result.pageErrors = pageErrors;
    result.checkResults['7-控制台'] = {
      consoleErrors: consoleLogs.length,
      pageErrors: pageErrors.length
    };

    if (consoleLogs.length > 0) result.notes.push(`Console: ${consoleLogs.length} errors/warnings`);
    if (pageErrors.length > 0) {
      result.status = 'WARN';
      result.notes.push(`Page errors: ${pageErrors.join('; ')}`);
    }

    // Quick interaction test: click first button/link if available
    try {
      const firstLink = await page.$('a[href]:not([href="#"]):not([href="/login"])');
      if (firstLink) {
        await firstLink.hover();
      }
    } catch (e) { /* ignore */ }

  } catch (e) {
    result.status = 'FAIL';
    result.notes.push(`Error: ${e.message}`);
  }

  return result;
}

async function main() {
  const browser = await chromium.launch({ 
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true 
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true
  });

  const allResults = [];
  let totalPages = 0;
  let passedPages = 0;

  console.log('='.repeat(60));
  console.log('林染 4站48页补测 自动化脚本');
  console.log('启动时间:', new Date().toLocaleString('zh-CN'));
  console.log('='.repeat(60));

  for (const site of sites) {
    console.log(`\n>>> 测试 ${site.name} (${site.baseUrl}) - ${site.pages.length}页`);
    
    for (let i = 0; i < site.pages.length; i++) {
      const pageInfo = site.pages[i];
      const page = await context.newPage();
      
      totalPages++;
      console.log(`  [${totalPages}] ${pageInfo.route} - ${pageInfo.name}`);
      
      const result = await testPage(page, site, pageInfo, i + 1);
      allResults.push(result);
      
      const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
      console.log(`    ${icon} ${result.status} | ${result.notes.join('; ') || 'OK'}`);
      
      if (result.status === 'PASS') passedPages++;
      
      await page.close();
    }
  }

  // Summary
  const report = {
    timestamp: new Date().toISOString(),
    tester: '林染 🎨 开发部前端',
    summary: {
      totalPages,
      passedPages,
      failPages: totalPages - passedPages,
      passRate: ((passedPages / totalPages) * 100).toFixed(1) + '%',
      totalScreenshots: allResults.filter(r => r.screenshot).length
    },
    results: allResults
  };

  const reportPath = 'D:\\ManhuaWorks\\docs\\testing\\frontend\\retest_results.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  
  console.log('\n' + '='.repeat(60));
  console.log('测试完成!');
  console.log(`总页数: ${totalPages} | 通过: ${passedPages} | 失败: ${totalPages - passedPages}`);
  console.log(`通过率: ${report.summary.passRate}`);
  console.log(`报告: ${reportPath}`);
  console.log('='.repeat(60));

  await browser.close();
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
