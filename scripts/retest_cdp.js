/**
 * 林染 - 4站48页补测 (CDP连接版)
 * 连接已运行的Chrome实例 (localhost:18800)
 */
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = 'D:\\ManhuaWorks\\docs\\testing\\frontend\\screenshots';

const sites = [
  { name: 'web', baseUrl: 'http://localhost:3000', pages: [
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
  ]},
  { name: 'admin', baseUrl: 'http://localhost:5174', pages: [
    { route: '/dashboard', name: '仪表盘 DashboardView' },
    { route: '/users', name: '用户管理 UsersView' },
    { route: '/billing', name: '计费管理 BillingView' },
    { route: '/audit', name: '审计日志 AuditView' },
    { route: '/settings', name: '系统设置 SettingsView' },
    { route: '/ops', name: '业务运营 OpsView' },
    { route: '/compliance', name: '合规审计 ComplianceView' },
    { route: '/projects', name: '项目审核 AdminProjectsView' },
    { route: '/logs', name: '系统日志 AdminLogsView' },
  ]},
  { name: 'ops', baseUrl: 'http://localhost:5176', pages: [
    { route: '/dashboard', name: '数据看板 DashboardView' },
    { route: '/users', name: '用户管理 UsersView' },
    { route: '/billing', name: '计费充值 BillingView' },
    { route: '/monitoring', name: '系统监控 MonitoringView' },
    { route: '/system', name: '系统管理 SystemView' },
    { route: '/logs', name: '运维日志 LogsView' },
  ]},
  { name: 'user', baseUrl: 'http://localhost:5180', pages: [
    { route: '/dashboard', name: '首页 HomeView' },
    { route: '/projects', name: '我的项目 MyProjectsView' },
    { route: '/works', name: '我的作品 MyWorksView' },
    { route: '/assets', name: '素材库 AssetLibraryView' },
    { route: '/settings', name: '设置 SettingsView' },
    { route: '/byok', name: 'API Key管理 ApiKeysView' },
    { route: '/team', name: '团队 TeamView' },
    { route: '/profile', name: '编辑资料 ProfileView' },
  ]},
  { name: 'studio', baseUrl: 'http://localhost:5175', pages: [
    { route: '/', name: '首页 HomeView' },
    { route: '/materials', name: '素材库 MaterialLibraryView' },
    { route: '/workflow', name: '工作流 WorkflowDesignerView' },
    { route: '/project', name: '项目编辑器 ProjectEditorView' },
    { route: '/tools', name: '工具箱 ToolboxView' },
    { route: '/export', name: '导出 ExportView' },
    { route: '/project/1/shots', name: '分镜网格 StoryboardGridView' },
    { route: '/project/1/shots/1', name: '分镜编辑器 ShotEditorView' },
  ]}
];

// Fetch CDP JSON
async function getCdpTargets() {
  const resp = await fetch('http://127.0.0.1:18800/json');
  return resp.json();
}

// Send CDP command
async function cdpSend(wsUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const ws = new (require('ws'))(wsUrl);
    const id = Math.random().toString(36).slice(2);
    ws.on('open', () => ws.send(JSON.stringify({ id, method, params })));
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        ws.close();
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
    ws.on('error', reject);
    setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 30000);
  });
}

async function testPage(wsUrl, site, pageInfo, idx) {
  const url = site.baseUrl + pageInfo.route;
  const screenshotName = `${site.name}_${String(idx).padStart(2,'0')}_${pageInfo.route.replace(/\//g,'_').replace(/^_/,'') || 'index'}.png`;
  const screenshotPath = path.join(SCREENSHOT_DIR, site.name, screenshotName);
  
  const result = { site: site.name, route: pageInfo.route, name: pageInfo.name, url, status: 'PASS', screenshot: screenshotPath, notes: [], consoleErrors: 0, pageErrors: 0 };

  try {
    // Enable Page domain
    await cdpSend(wsUrl, 'Page.enable');
    await cdpSend(wsUrl, 'Runtime.enable');
    
    // Navigate
    const navResult = await cdpSend(wsUrl, 'Page.navigate', { url });
    if (navResult.errorText) {
      result.notes.push(`Nav error: ${navResult.errorText}`);
      result.status = 'FAIL';
    }
    
    // Wait for load
    await cdpSend(wsUrl, 'Page.loadEventFired');
    await new Promise(r => setTimeout(r, 2000));
    
    // Screenshot
    try {
      const screenshotData = await cdpSend(wsUrl, 'Page.captureScreenshot', { format: 'png', fullPage: true, captureBeyondViewport: true });
      if (screenshotData && screenshotData.data) {
        fs.writeFileSync(screenshotPath, Buffer.from(screenshotData.data, 'base64'));
      }
    } catch (e) {
      result.notes.push(`Screenshot failed: ${e.message}`);
    }
    
    // Get page info via evaluate
    try {
      const info = await cdpSend(wsUrl, 'Runtime.evaluate', {
        expression: `JSON.stringify({
          title: document.title,
          buttons: document.querySelectorAll('button, [role="button"]').length,
          links: document.querySelectorAll('a[href]').length,
          inputs: document.querySelectorAll('input, textarea, select').length,
          forms: document.querySelectorAll('form').length,
          modals: document.querySelectorAll('[role="dialog"], .modal, .dialog').length,
          bodyText: document.body ? document.body.innerText.substring(0, 500) : '',
          hasVueApp: !!document.querySelector('#app'),
          hasRouter: !!(window.__VUE_DEVTOOLS_GLOBAL_HOOK__)
        })`,
        returnByValue: true
      });
      if (info && info.result && info.result.value) {
        const pageInfoData = JSON.parse(info.result.value);
        result.pageInfo = pageInfoData;
        if (!pageInfoData.title) result.notes.push('No page title');
        if (!pageInfoData.bodyText || pageInfoData.bodyText.length < 10) {
          result.status = 'WARN';
          result.notes.push('Page appears empty');
        }
      }
    } catch (e) {
      result.notes.push(`Eval error: ${e.message}`);
    }
    
  } catch (e) {
    result.status = 'FAIL';
    result.notes.push(`Fatal: ${e.message}`);
  }
  
  return result;
}

async function main() {
  console.log('林染 4站48页补测 (CDP连接版)');
  console.log('启动:', new Date().toLocaleString('zh-CN'));
  
  const targets = await getCdpTargets();
  
  // Find the first page target
  let pageTarget = targets.find(t => t.type === 'page');
  if (!pageTarget) {
    // Create a new page
    const resp = await fetch('http://127.0.0.1:18800/json/new?' + Date.now());
    const newPage = await resp.json();
    pageTarget = newPage;
  }
  
  console.log(`Using target: ${pageTarget.id} at ${pageTarget.url}`);
  
  const allResults = [];
  let totalPages = 0;
  let passedPages = 0;
  
  for (const site of sites) {
    console.log(`\n>>> ${site.name} (${site.pages.length}页) ${site.baseUrl}`);
    
    for (let i = 0; i < site.pages.length; i++) {
      totalPages++;
      console.log(`  [${totalPages}] ${site.pages[i].route}`);
      
      const result = await testPage(pageTarget.webSocketDebuggerUrl, site, site.pages[i], i + 1);
      allResults.push(result);
      
      const icon = result.status === 'PASS' ? 'v' : result.status === 'WARN' ? '!' : 'x';
      console.log(`    ${icon} ${result.status} ${result.notes.join('; ') || 'OK'}`);
      
      if (result.status === 'PASS') passedPages++;
    }
  }
  
  const reportPath = 'D:\\ManhuaWorks\\docs\\testing\\frontend\\retest_results.json';
  const report = {
    timestamp: new Date().toISOString(),
    tester: '林染',
    summary: { totalPages, passedPages, failPages: totalPages - passedPages, passRate: ((passedPages/totalPages)*100).toFixed(1)+'%' },
    results: allResults
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  
  console.log(`\n=== 完成! ${totalPages}页, 通过${passedPages}, 失败${totalPages-passedPages} ===`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
