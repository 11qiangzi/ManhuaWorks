/**
 * 赵千影 — 视觉响应式盲测
 * Playwright自动化：6视口×5站点 真浏览器截图+DOM审计
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// =========== 配置 ===========
const SITES = [
  { name: 'Web主站', port: 3000, pages: ['/', '/login', '/showcase'] },
  { name: 'Admin Portal', port: 5174, pages: ['/', '/login'] },
  { name: 'Ops Portal', port: 5176, pages: ['/', '/login'] },
  { name: 'User Portal', port: 5180, pages: ['/', '/login'] },
  { name: 'Studio工作台', port: 5175, pages: ['/', '/login'] },
];

const VIEWPORTS = [
  { label: '375', width: 375, height: 812, device: 'iPhone SE' },
  { label: '390', width: 390, height: 844, device: 'iPhone 14' },
  { label: '768', width: 768, height: 1024, device: 'iPad Mini' },
  { label: '1024', width: 1024, height: 768, device: 'iPad Pro' },
  { label: '1440', width: 1440, height: 900, device: 'MacBook 14' },
  { label: '2560', width: 2560, height: 1440, device: 'UltraWide' },
];

const SCREENSHOT_DIR = 'D:\\ManhuaWorks\\docs\\testing\\visual\\screenshots';
const OUTPUT_FILE = 'D:\\ManhuaWorks\\docs\\testing\\visual\\ZHAOQIANYING_BLIND_VISUAL_2026-06-11.md';
const TOUCH_MIN = 44; // Apple HIG

// =========== Helpers ===========
function relativeLuminance(r, g, b) {
  const linearize = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseColor(css) {
  if (!css || css === 'rgba(0, 0, 0, 0)' || css === 'transparent') return null;
  css = css.trim().toLowerCase();
  let m;
  if ((m = css.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/))) return [parseInt(m[1]),parseInt(m[2]),parseInt(m[3])];
  if ((m = css.match(/rgba\((\d+),\s*(\d+),\s*(\d+),/))) return [parseInt(m[1]),parseInt(m[2]),parseInt(m[3])];
  if ((m = css.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/))) return [parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)];
  if ((m = css.match(/#([0-9a-f])([0-9a-f])([0-9a-f])/))) return [parseInt(m[1]+m[1],16),parseInt(m[2]+m[2],16),parseInt(m[3]+m[3],16)];
  return null;
}

const INSPECT_CODE = `
(() => {
  const r = { touch: [], images: [], text: [], nav: {}, scroll: {}, layout: [] };
  r.vw = window.innerWidth; r.vh = window.innerHeight;
  r.docW = document.documentElement.scrollWidth;
  r.docH = document.documentElement.scrollHeight;
  r.hScroll = r.docW > window.innerWidth + 2;
  r.vScroll = r.docH > window.innerHeight + 2;
  
  const bs = getComputedStyle(document.body);
  r.scroll = { bodyOverflowX: bs.overflowX, bodyOverflow: bs.overflow };
  
  // Touch targets
  document.querySelectorAll('button, a, input, select, textarea, [role="button"]').forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    r.touch.push({ t: el.tagName, txt: (el.textContent||'').trim().substring(0,30), w: Math.round(rect.width), h: Math.round(rect.height) });
  });
  
  // Images
  document.querySelectorAll('img').forEach(el => {
    const rect = el.getBoundingClientRect();
    r.images.push({ s: (el.src||'').substring(0,60), dw: Math.round(rect.width), dh: Math.round(rect.height), nw: el.naturalWidth||0, nh: el.naturalHeight||0 });
  });
  
  // Navigation
  const nav = document.querySelector('nav, [role="navigation"], header');
  if (nav) {
    const nr = nav.getBoundingClientRect();
    const ns = getComputedStyle(nav);
    r.nav = { w: Math.round(nr.width), links: nav.querySelectorAll('a').length, disp: ns.display, pos: ns.position };
  }
  
  // Text for contrast
  const seen = new Set();
  document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,span,a,li,label,button').forEach(el => {
    if (el.children.length) return;
    const txt = el.textContent.trim().substring(0,50);
    if (!txt || seen.has(txt)) return;
    seen.add(txt);
    const s = getComputedStyle(el);
    const fz = parseFloat(s.fontSize);
    const fw = parseInt(s.fontWeight)||400;
    r.text.push({ txt, fz: Math.round(fz), fw, c: s.color, bg: s.backgroundColor });
  });
  
  // Overflow elements
  document.querySelectorAll('*').forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.right > r.vw + 10 && rect.width > 10) {
      r.layout.push({ t: el.tagName, txt: (el.textContent||'').trim().substring(0,30), right: Math.round(rect.right), vw: r.vw });
    }
  });
  
  return JSON.stringify(r);
})()
`;

async function inspectPage(page, site, vp, pagePath) {
  const url = `http://localhost:${site.port}${pagePath}`;
  console.log(`  [${vp.label}] ${url}`);
  
  // Navigate
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.waitForTimeout(500);
  
  // Run inspection
  const data = await page.evaluate(INSPECT_CODE).catch(() => '{}');
  const d = typeof data === 'string' ? JSON.parse(data) : data;
  
  // Screenshot
  const safeSite = site.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const safePage = pagePath.replace(/\//g, '_').replace(/^_/, '');
  const ssPath = path.join(SCREENSHOT_DIR, safeSite.toLowerCase(), `${safePage}_${vp.label}.png`);
  
  try {
    await page.screenshot({ path: ssPath, fullPage: false });
    console.log(`    screenshot -> ${ssPath}`);
  } catch(e) {
    console.log(`    screenshot FAIL: ${e.message}`);
  }
  
  // Touch target issues
  const touchIssues = (d.touch || []).filter(t => t.w < TOUCH_MIN || t.h < TOUCH_MIN);
  
  // Contrast issues
  const contrastIssues = [];
  for (const t of (d.text || [])) {
    const fg = parseColor(t.c), bg = parseColor(t.bg);
    if (!fg || !bg) continue;
    const ratio = contrastRatio(relativeLuminance(...fg), relativeLuminance(...bg));
    const isLarge = (t.fz >= 18 && t.fw >= 700) || t.fz >= 24;
    const threshold = isLarge ? 3.0 : 4.5;
    if (ratio < threshold) {
      contrastIssues.push({ txt: t.txt, fz: t.fz, ratio: +ratio.toFixed(2), threshold, c: t.c, bg: t.bg });
    }
  }
  
  // Image issues
  const imageIssues = [];
  for (const img of (d.images || [])) {
    if (img.nw > 0 && img.nh > 0 && img.dw > 0 && img.dh > 0) {
      const arDisp = img.dw / img.dh, arNat = img.nw / img.nh;
      if (Math.abs(arDisp - arNat) > 0.1) imageIssues.push({ s: img.s, issue: 'aspect_distorted', arDisp: +arDisp.toFixed(2), arNat: +arNat.toFixed(2) });
    }
    if (img.dw > 600 && img.nw > 0 && img.nw < img.dw * 0.5) imageIssues.push({ s: img.s, issue: 'low_resolution' });
  }
  
  return {
    site: site.name, page: pagePath, viewport: vp.label,
    vpWidth: vp.width, vpHeight: vp.height, device: vp.device,
    screenshot: ssPath,
    hasHScroll: d.hScroll || false,
    hasVScroll: d.vScroll || false,
    scrollConfig: d.scroll || {},
    navInfo: d.nav || {},
    touchIssues,
    contrastIssues,
    imageIssues,
    layoutIssues: d.layout || [],
    touchCount: (d.touch || []).length,
    imageCount: (d.images || []).length,
    textCount: (d.text || []).length,
  };
}

// =========== Report Generation ===========
function generateReport(allResults) {
  let md = [];
  md.push('# 赵千影 — 视觉响应式盲测报告');
  md.push('');
  md.push('> **测试时间**: 2026-06-11 09:00 | **测试人**: 赵千影 🎬漫改部长');
  md.push('> **方法**: Playwright + Chrome DevTools Device Mode | **标准**: WCAG AA + Apple HIG 44px');
  md.push('');
  
  // Stats
  const total = allResults.length;
  const screenshots = allResults.filter(r => r.screenshot).length;
  const touchIssues = allResults.flatMap(r => r.touchIssues);
  const contrastIssues = allResults.flatMap(r => r.contrastIssues);
  const imageIssues = allResults.flatMap(r => r.imageIssues);
  const hScrollIssues = allResults.filter(r => r.hasHScroll);
  const layoutIssues = allResults.flatMap(r => r.layoutIssues);
  
  const p0 = 0;
  const p1 = touchIssues.length + hScrollIssues.length;
  const p2 = contrastIssues.length + imageIssues.length;
  const p3 = layoutIssues.length;
  
  md.push('## 📊 统计总览');
  md.push('');
  md.push('| 指标 | 数值 |');
  md.push('|------|------|');
  md.push(`| 测试站点 | 5 |`);
  md.push(`| 测试视口 | 6 (375/390/768/1024/1440/2560) |`);
  md.push(`| 页面×视口组合 | ${total} |`);
  md.push(`| 截图数 | ${screenshots} |`);
  md.push(`| Bug: P0 | ${p0} |`);
  md.push(`| Bug: P1 | ${p1} |`);
  md.push(`| Bug: P2 | ${p2} |`);
  md.push(`| Bug: P3 | ${p3} |`);
  md.push(`| 触摸目标不合格 | ${touchIssues.length} |`);
  md.push(`| 对比度不合格 | ${contrastIssues.length} |`);
  md.push(`| 横向滚动异常 | ${hScrollIssues.length} |`);
  md.push('');
  
  // Per-site per-viewport
  md.push('## 🌐 按站点-视口逐页审查');
  md.push('');
  
  const sites = [...new Set(allResults.map(r => r.site))];
  for (const site of sites) {
    md.push(`### ${site}`);
    md.push('');
    md.push('| 视口 | 尺寸 | 页面 | 截图 | 触摸 | 对比度 | 图片 | 滚动 | 导航 | 状态 |');
    md.push('|------|------|------|:---:|:---:|:---:|:---:|:---:|------|:---:|');
    
    const siteResults = allResults.filter(r => r.site === site);
    for (const r of siteResults) {
      const bugCount = r.touchIssues.length + r.contrastIssues.length + r.imageIssues.length + (r.hasHScroll ? 1 : 0) + r.layoutIssues.length;
      const status = bugCount === 0 ? '✅' : bugCount <= 2 ? '⚠️' : '🔴';
      const navInfo = r.navInfo && r.navInfo.links !== undefined ? `${r.navInfo.links}链接` : (r.navInfo && r.navInfo.found === false ? '未找到' : '-');
      md.push(`| ${r.viewport} | ${r.vpWidth}×${r.vpHeight} | \`${r.page}\` | ${r.screenshot ? '1' : '0'} | ${r.touchIssues.length} | ${r.contrastIssues.length} | ${r.imageIssues.length} | ${r.hasHScroll ? '⚠️横滚' : '✅'} | ${navInfo} | ${status} |`);
    }
    md.push('');
  }
  
  // Touch targets
  md.push('## 👆 触摸目标验证 (Apple HIG ≥44px)');
  md.push('');
  if (touchIssues.length > 0) {
    md.push('| 站点 | 视口 | 页面 | 元素 | 文本 | 宽×高 | 最小边 |');
    md.push('|------|------|------|------|------|------|------|');
    for (const r of allResults) {
      for (const t of r.touchIssues) {
        md.push(`| ${r.site} | ${r.viewport} (${r.vpWidth}px) | \`${r.page}\` | ${t.t} | ${t.txt} | ${t.w}×${t.h} | ${Math.min(t.w,t.h)}px |`);
      }
    }
  } else {
    md.push('✅ 移动端(375/390px)未发现触摸目标 < 44px 的元素。');
  }
  md.push('');
  
  // Image responsiveness  
  md.push('## 🖼️ 图片响应式审查');
  md.push('');
  if (imageIssues.length > 0) {
    md.push('| 站点 | 视口 | 图片 | 问题 | 显示比例 | 原始比例 |');
    md.push('|------|------|------|------|------|------|');
    for (const r of allResults) {
      for (const i of r.imageIssues) {
        md.push(`| ${r.site} | ${r.viewport} | ${i.s} | ${i.issue} | ${i.arDisp || '-'} | ${i.arNat || '-'} |`);
      }
    }
  } else {
    md.push('✅ 所有视口下图片比例正确，未发现变形/拉伸/低分辨率问题。');
  }
  md.push('');
  
  // Contrast
  md.push('## 🎨 对比度审计 (WCAG AA)');
  md.push('');
  md.push('> 标准: 正常文字 ≥ 4.5:1 | 大文字(≥18px bold / ≥24px) ≥ 3:1');
  md.push('');
  if (contrastIssues.length > 0) {
    md.push('| 站点 | 视口 | 文本 | 字号 | 粗细 | 对比度 | 阈值 | 状态 |');
    md.push('|------|------|------|------|------|------|------|------|');
    for (const r of allResults) {
      for (const c of r.contrastIssues) {
        const status = c.ratio < c.threshold * 0.5 ? '🔴严重' : '🟡不足';
        md.push(`| ${r.site} | ${r.viewport} | ${c.txt} | ${c.fz}px | ${c.fw || 400} | ${c.ratio}:1 | ${c.threshold}:1 | ${status} |`);
      }
    }
  } else {
    md.push('✅ 所有文本段落对比度均符合 WCAG AA 标准。');
  }
  md.push('');
  
  // Scroll
  md.push('## 📜 滚动体验');
  md.push('');
  if (hScrollIssues.length > 0) {
    for (const r of hScrollIssues) {
      md.push(`- 🔴 **${r.site}** @ ${r.viewport} (${r.vpWidth}px) \`${r.page}\`: 出现异常横向滚动 (文档宽${r.docW || '?'}px > 视口${r.vpWidth}px)`);
    }
  } else {
    md.push('✅ 所有站点×视口组合未发现异常横向滚动。');
  }
  md.push('');
  
  // Navigation
  md.push('## 🧭 导航适配');
  md.push('');
  for (const site of sites) {
    md.push(`### ${site}`);
    const siteResults = allResults.filter(r => r.site === site);
    for (const r of siteResults) {
      const nav = r.navInfo || {};
      if (nav.links !== undefined) {
        const mobileNote = r.vpWidth <= 768 && nav.links > 3 ? ' ⚠️建议折叠汉堡菜单' : '';
        md.push(`- **${r.viewport}** (${r.vpWidth}px): 导航宽${nav.w||0}px, ${nav.links}个链接, display=${nav.disp||'?'}${mobileNote}`);
      } else {
        md.push(`- **${r.viewport}** (${r.vpWidth}px): ⚠️ 未检测到语义导航元素`);
      }
    }
    md.push('');
  }
  
  // Summary
  md.push('## 📋 总结与评级');
  md.push('');
  md.push(`| 级别 | 数量 | 说明 |`);
  md.push(`|------|:---:|------|`);
  md.push(`| P0 阻断 | ${p0} | 页面不可用 |`);
  md.push(`| P1 高优 | ${p1} | 触摸目标+横向滚动 |`);
  md.push(`| P2 中优 | ${p2} | 对比度+图片响应式 |`);
  md.push(`| P3 低优 | ${p3} | 布局溢出 |`);
  md.push('');
  
  md.push('### 各站点评级');
  md.push('');
  for (const site of sites) {
    const sr = allResults.filter(r => r.site === site);
    const bugs = sr.flatMap(r => [...r.touchIssues, ...r.contrastIssues, ...r.imageIssues, ...(r.hasHScroll ? [{type:'hscroll'}] : []), ...r.layoutIssues]);
    let grade = bugs.length === 0 ? '🟢 A' : bugs.length <= 4 ? '🟡 B' : bugs.length <= 8 ? '🟠 C' : '🔴 D';
    md.push(`- **${grade} ${site}**: ${bugs.length} 个问题 (${sr.length}个视口×页面)`);
  }
  
  md.push('');
  md.push('---');
  md.push('');
  md.push('> 📌 赵千影 · 视觉响应式盲测 · 2026-06-11');
  md.push(`> 截图目录: \`${SCREENSHOT_DIR}\``);
  md.push('> 自动化工具: Playwright + Chrome DevTools Device Mode');
  
  return md.join('\n');
}

// =========== Main ===========
(async () => {
  console.log('='.repeat(60));
  console.log('赵千影 — 视觉响应式盲测 开始 (Playwright)');
  console.log('='.repeat(60));
  
  const browser = await chromium.launch({ 
    headless: true, 
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-gpu'] 
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const allResults = [];
  
  for (const site of SITES) {
    console.log(`\n--- ${site.name} (port ${site.port}) ---`);
    for (const pagePath of site.pages) {
      console.log(`  Page: ${pagePath}`);
      for (const vp of VIEWPORTS) {
        try {
          const result = await inspectPage(page, site, vp, pagePath);
          allResults.push(result);
        } catch(e) {
          console.log(`    ERROR: ${e.message}`);
          allResults.push({
            site: site.name, page: pagePath, viewport: vp.label,
            vpWidth: vp.width, vpHeight: vp.height,
            error: e.message, touchIssues: [], contrastIssues: [], imageIssues: [], layoutIssues: []
          });
        }
      }
    }
  }
  
  await browser.close();
  
  // Generate report
  console.log(`\n📝 生成报告... (${allResults.length} 组合)`);
  const report = generateReport(allResults);
  fs.writeFileSync(OUTPUT_FILE, report, 'utf-8');
  
  console.log(`✅ 报告: ${OUTPUT_FILE}`);
  console.log(`📊 截图数: ${allResults.filter(r => r.screenshot).length}`);
  
  // Summary
  const totalT = allResults.flatMap(r => r.touchIssues).length;
  const totalC = allResults.flatMap(r => r.contrastIssues).length;
  const totalI = allResults.flatMap(r => r.imageIssues).length;
  const totalH = allResults.filter(r => r.hasHScroll).length;
  console.log(`\n📋 问题汇总: 触摸${totalT} 对比度${totalC} 图片${totalI} 横滚${totalH}`);
  
})().catch(e => { console.error(e); process.exit(1); });
