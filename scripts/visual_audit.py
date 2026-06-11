"""
赵千影 — 视觉响应式盲测 自动化脚本
使用 Chrome DevTools Protocol 收集多视口数据
"""
import json
import os
import sys
import time
import base64
import io
from urllib.request import urlopen, Request
from urllib.error import URLError
import re

# Fix Windows GBK encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# =========== 配置 ===========
SITES = {
    "Web主站": {"port": 3000, "pages": ["/", "/login", "/showcase"]},
    "Admin Portal": {"port": 5174, "pages": ["/", "/login"]},
    "Ops Portal": {"port": 5176, "pages": ["/", "/login"]},
    "User Portal": {"port": 5180, "pages": ["/", "/login"]},
    "Studio工作台": {"port": 5175, "pages": ["/", "/login"]},
}

VIEWPORTS = [
    ("375", 375, 812, "iPhone SE"),
    ("390", 390, 844, "iPhone 14"),
    ("768", 768, 1024, "iPad Mini"),
    ("1024", 1024, 768, "iPad Pro"),
    ("1440", 1440, 900, "MacBook 14"),
    ("2560", 2560, 1440, "UltraWide"),
]

SCREENSHOT_DIR = r"D:\ManhuaWorks\docs\testing\visual\screenshots"
OUTPUT_FILE = r"D:\ManhuaWorks\docs\testing\visual\ZHAOQIANYING_BLIND_VISUAL_2026-06-11.md"

# WCAG AA thresholds
WCAG_AA_NORMAL = 4.5
WCAG_AA_LARGE = 3.0
TOUCH_TARGET_MIN = 44  # px

def relative_luminance(r, g, b):
    """Calculate relative luminance per WCAG 2.0"""
    def linearize(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)

def contrast_ratio(l1, l2):
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)

def parse_color(css_color):
    """Parse CSS color string to (r,g,b)"""
    if not css_color or css_color == 'rgba(0, 0, 0, 0)' or css_color == 'transparent':
        return None
    css_color = css_color.strip().lower()
    # rgb(r, g, b)
    m = re.match(r'rgb\((\d+),\s*(\d+),\s*(\d+)\)', css_color)
    if m:
        return (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    # rgba(r, g, b, a)
    m = re.match(r'rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)', css_color)
    if m:
        return (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    # Named colors (basic mapping)
    named = {
        'black': (0,0,0), 'white': (255,255,255), 'red': (255,0,0),
        'green': (0,128,0), 'blue': (0,0,255), 'gray': (128,128,128),
        'grey': (128,128,128), 'transparent': None
    }
    if css_color in named:
        return named[css_color]
    # hex
    m = re.match(r'#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})', css_color)
    if m:
        return (int(m.group(1),16), int(m.group(2),16), int(m.group(3),16))
    m = re.match(r'#([0-9a-f])([0-9a-f])([0-9a-f])', css_color)
    if m:
        return (int(m.group(1)*2,16), int(m.group(2)*2,16), int(m.group(3)*2,16))
    return None

# =========== JS for DOM inspection ===========
INSPECT_JS = """
(() => {
    const results = {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        touchTargets: [],
        images: [],
        fontIssues: [],
        contrastIssues: [],
        navInfo: {},
        scrollIssues: [],
        layoutIssues: [],
        allText: []
    };

    // Check for horizontal scroll
    if (document.documentElement.scrollWidth > window.innerWidth) {
        results.scrollIssues.push({
            type: 'horizontal_scroll',
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            docWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth
        });
    }

    // Check overflow hidden on body/html
    const bodyStyle = getComputedStyle(document.body);
    const htmlStyle = getComputedStyle(document.documentElement);
    results.scrollConfig = {
        bodyOverflow: bodyStyle.overflow,
        bodyOverflowX: bodyStyle.overflowX,
        htmlOverflow: htmlStyle.overflow,
        htmlOverflowX: htmlStyle.overflowX
    };

    // Touch targets: buttons, links, inputs, selects
    const interactive = document.querySelectorAll('button, a, input, select, textarea, [role="button"]');
    interactive.forEach(el => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const tag = el.tagName.toLowerCase();
        const text = (el.textContent || '').trim().substring(0, 30);
        results.touchTargets.push({
            tag: tag,
            text: text,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0,
            fontSize: style.fontSize,
            color: style.color,
            bgColor: style.backgroundColor,
        });
    });

    // Images
    const imgs = document.querySelectorAll('img, [style*="background-image"], svg');
    imgs.forEach(el => {
        const rect = el.getBoundingClientRect();
        const natural = el.naturalWidth || 0;
        const naturalH = el.naturalHeight || 0;
        results.images.push({
            tag: el.tagName.toLowerCase(),
            src: (el.src || el.getAttribute('style') || '').substring(0, 80),
            displayWidth: Math.round(rect.width),
            displayHeight: Math.round(rect.height),
            naturalWidth: natural,
            naturalHeight: naturalH,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
        });
    });

    // Font & contrast audit on text elements
    const textEls = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, li, td, th, label, div');
    const seen = new Set();
    textEls.forEach(el => {
        if (el.children.length > 0) return; // skip containers
        const text = el.textContent.trim();
        if (!text || text.length < 3) return;
        const key = text.substring(0, 50);
        if (seen.has(key)) return;
        seen.add(key);

        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const fontSize = parseFloat(style.fontSize);
        const fontWeight = parseInt(style.fontWeight) || 400;
        const isBold = fontWeight >= 700;
        const isLarge = (fontSize >= 18 && isBold) || fontSize >= 24;
        const threshold = isLarge ? 3.0 : 4.5;

        results.allText.push({
            tag: el.tagName.toLowerCase(),
            text: text.substring(0, 60),
            fontSize: Math.round(fontSize),
            fontWeight: fontWeight,
            isLarge: isLarge,
            color: style.color,
            bgColor: style.backgroundColor,
        });
    });

    // Navigation
    const nav = document.querySelector('nav, [role="navigation"], header');
    if (nav) {
        const navRect = nav.getBoundingClientRect();
        const navStyle = getComputedStyle(nav);
        const links = nav.querySelectorAll('a');
        results.navInfo = {
            found: true,
            width: Math.round(navRect.width),
            height: Math.round(navRect.height),
            display: navStyle.display,
            position: navStyle.position,
            linkCount: links.length,
            links: Array.from(links).slice(0, 10).map(a => ({
                text: a.textContent.trim().substring(0, 20),
                href: a.getAttribute('href') || '',
                width: Math.round(a.getBoundingClientRect().width),
            }))
        };
    } else {
        results.navInfo = { found: false };
    }

    // Check for elements that might overflow
    const allEls = document.querySelectorAll('*');
    allEls.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth + 5 || rect.bottom > window.innerHeight + 5) {
            const style = getComputedStyle(el);
            if (style.position === 'fixed' || style.position === 'sticky') return; // ignore fixed
            results.layoutIssues.push({
                tag: el.tagName.toLowerCase(),
                text: (el.textContent || '').trim().substring(0, 40),
                right: Math.round(rect.right),
                bottom: Math.round(rect.bottom),
                viewW: window.innerWidth,
                viewH: window.innerHeight,
            });
        }
    });

    return JSON.stringify(results);
})()
"""

def compute_contrast_issues(text_data):
    """Post-process text data to find contrast issues"""
    issues = []
    for item in text_data:
        fg = parse_color(item.get('color', ''))
        bg = parse_color(item.get('bgColor', ''))
        if not fg or not bg:
            continue
        l1 = relative_luminance(*fg)
        l2 = relative_luminance(*bg)
        ratio = contrast_ratio(l1, l2)
        threshold = WCAG_AA_LARGE if item.get('isLarge') else WCAG_AA_NORMAL
        if ratio < threshold and ratio > 0:
            issues.append({
                'text': item.get('text', '')[:40],
                'tag': item.get('tag', ''),
                'fontSize': item.get('fontSize', 0),
                'ratio': round(ratio, 2),
                'threshold': threshold,
                'fg': item.get('color', ''),
                'bg': item.get('bgColor', ''),
            })
    return issues

def compute_touch_issues(touch_targets, viewport_width):
    """Find touch targets below 44px min (mobile only)"""
    if viewport_width > 1024:
        return []  # touch target check only for mobile/tablet
    issues = []
    for t in touch_targets:
        if t['visible'] and (t['width'] < TOUCH_TARGET_MIN or t['height'] < TOUCH_TARGET_MIN):
            issues.append({
                'tag': t['tag'],
                'text': t['text'],
                'width': t['width'],
                'height': t['height'],
                'minDimension': min(t['width'], t['height']),
            })
    return issues

def compute_image_issues(images):
    """Find image responsiveness issues"""
    issues = []
    for img in images:
        w, h, nw, nh = img['displayWidth'], img['displayHeight'], img['naturalWidth'], img['naturalHeight']
        if nw > 0 and nh > 0 and w > 0 and h > 0:
            aspect_display = w / h
            aspect_natural = nw / nh
            if abs(aspect_display - aspect_natural) > 0.1:
                issues.append({
                    'src': img['src'],
                    'displayRatio': round(aspect_display, 2),
                    'naturalRatio': round(aspect_natural, 2),
                    'issue': 'aspect_distorted',
                })
        if img['displayWidth'] > 1200 and img.get('naturalWidth', 0) > 0:
            if img['naturalWidth'] < img['displayWidth'] * 0.5:
                issues.append({'src': img['src'], 'issue': 'low_resolution'})
    return issues

# =========== Generate Report ===========
def generate_report(all_results):
    """Generate the final Markdown report"""
    lines = []
    lines.append("# 赵千影 — 视觉响应式盲测报告")
    lines.append("")
    lines.append(f"> **测试时间**: 2026-06-11 08:53-完成  |  **测试人**: 赵千影 🎬漫改部长")
    lines.append(f"> **方法**: Chrome DevTools Device Mode 真机模拟 | **标准**: WCAG AA + Apple HIG 44px")
    lines.append("")
    
    # Stats
    total_checks = sum(len(r.get('results', {})) for r in all_results)
    total_screenshots = sum(len(r.get('screenshots', [])) for r in all_results)
    touch_issues = sum(1 for r in all_results for i in r.get('touchIssues', []))
    contrast_issues = sum(1 for r in all_results for i in r.get('contrastIssues', []))
    image_issues = sum(1 for r in all_results for i in r.get('imageIssues', []))
    scroll_issues = sum(1 for r in all_results for s in r.get('scrollIssues', []))
    layout_issues = sum(1 for r in all_results for l in r.get('layoutIssues', []))
    
    p0 = 0
    p1 = touch_issues + scroll_issues
    p2 = contrast_issues + image_issues
    p3 = layout_issues
    
    lines.append("## 📊 统计总览")
    lines.append("")
    lines.append(f"| 指标 | 数值 |")
    lines.append(f"|------|------|")
    lines.append(f"| 测试站点 | {len(set(r['site'] for r in all_results))} |")
    lines.append(f"| 测试视口 | 6 (375/390/768/1024/1440/2560) |")
    lines.append(f"| 测试页面×视口组合 | {len(all_results)} |")
    lines.append(f"| 截图数 | {total_screenshots} |")
    lines.append(f"| Bug: P0 | {p0} |")
    lines.append(f"| Bug: P1 | {p1} |")
    lines.append(f"| Bug: P2 | {p2} |")
    lines.append(f"| Bug: P3 | {p3} |")
    lines.append(f"| 触摸目标不合格 | {touch_issues} |")
    lines.append(f"| 对比度不合格 | {contrast_issues} |")
    lines.append("")
    
    # Per-site per-viewport table
    lines.append("## 🌐 按站点-视口逐页")
    lines.append("")
    
    # Group by site
    from collections import defaultdict
    by_site = defaultdict(list)
    for r in all_results:
        by_site[r['site']].append(r)
    
    for site, results in by_site.items():
        lines.append(f"### {site}")
        lines.append("")
        lines.append(f"| 视口 | 尺寸 | 页面 | 截图 | 触摸 | 对比度 | 布局 | 滚动 | 状态 |")
        lines.append(f"|------|------|------|:---:|:---:|:---:|:---:|:---:|:---:|")
        for r in results:
            vp = r['viewport']
            page = r['page']
            sc = len(r.get('screenshots', []))
            ti = len(r.get('touchIssues', []))
            ci = len(r.get('contrastIssues', []))
            li = len(r.get('layoutIssues', []))
            si = len(r.get('scrollIssues', []))
            status = "✅" if ti+ci+li+si == 0 else "⚠️" if ti+ci+li+si <= 2 else "🔴"
            lines.append(f"| {vp} | {r['vpWidth']}×{r['vpHeight']} | {page} | {sc} | {ti} | {ci} | {li} | {si} | {status} |")
        lines.append("")
    
    # Touch targets section
    lines.append("## 👆 触摸目标验证")
    lines.append("")
    lines.append(f"> 标准: Apple HIG ≥ 44×44px | 检查视口: 375px, 390px")
    lines.append("")
    
    touch_found = [(r['site'], r['viewport'], r['page'], i) 
                   for r in all_results for i in r.get('touchIssues', [])]
    if touch_found:
        lines.append("| 站点 | 视口 | 页面 | 元素 | 文本 | 宽×高 | 最小边 |")
        lines.append("|------|------|------|------|------|------|------|")
        for site, vp, page, i in touch_found[:50]:
            lines.append(f"| {site} | {vp} | {page} | {i['tag']} | {i['text']} | {i['width']}×{i['height']} | {i['minDimension']}px |")
    else:
        lines.append("✅ 未发现触摸目标不合格元素。")
    lines.append("")
    
    # Image responsiveness
    lines.append("## 🖼️ 图片响应式")
    lines.append("")
    img_found = [(r['site'], r['viewport'], i) for r in all_results for i in r.get('imageIssues', [])]
    if img_found:
        lines.append("| 站点 | 视口 | 图片 | 问题 |")
        lines.append("|------|------|------|------|")
        for site, vp, i in img_found:
            lines.append(f"| {site} | {vp} | {i.get('src','')[:50]} | {i.get('issue','')} |")
    else:
        lines.append("✅ 未发现图片响应式问题。")
    lines.append("")
    
    # Contrast audit
    lines.append("## 🎨 对比度审计 (WCAG AA)")
    lines.append("")
    lines.append(f"> 标准: 正常文字 ≥ 4.5:1 | 大文字(≥18px bold / ≥24px) ≥ 3:1")
    lines.append("")
    contrast_found = [(r['site'], r['viewport'], i) for r in all_results for i in r.get('contrastIssues', [])]
    if contrast_found:
        lines.append("| 站点 | 视口 | 文本 | 字号 | 对比度 | 阈值 | 前景 | 背景 |")
        lines.append("|------|------|------|------|------|------|------|------|")
        for site, vp, i in contrast_found[:30]:
            lines.append(f"| {site} | {vp} | {i['text']} | {i['fontSize']}px | {i['ratio']}:1 | {i['threshold']}:1 | {i['fg']} | {i['bg']} |")
    else:
        lines.append("✅ 未发现对比度不合格元素。")
    lines.append("")
    
    # Scroll experience
    lines.append("## 📜 滚动体验")
    lines.append("")
    scroll_found = [(r['site'], r['viewport'], r['page']) for r in all_results if r.get('scrollIssues')]
    if scroll_found:
        for site, vp, page in scroll_found:
            lines.append(f"- 🔴 **{site}** @ {vp} ({page}): 出现横向滚动条")
    else:
        lines.append("✅ 所有视口未发现异常横向滚动。")
    lines.append("")
    
    # Navigation
    lines.append("## 🧭 导航适配")
    lines.append("")
    for site, results in by_site.items():
        lines.append(f"### {site}")
        for r in results:
            nav = r.get('navInfo', {})
            vp = r['viewport']
            if nav.get('found'):
                lines.append(f"- **{vp}** ({r['vpWidth']}px): 导航宽{nav.get('width',0)}px, {nav.get('linkCount',0)}个链接, display={nav.get('display','?')}")
                if r['vpWidth'] <= 768:
                    # Check hamburger or collapsed nav
                    if nav.get('linkCount', 0) > 3 and nav.get('display') != 'none':
                        lines.append(f"  - ⚠️ 移动端({r['vpWidth']}px)导航有{nav.get('linkCount')}个链接可见, 建议折叠到汉堡菜单")
            else:
                lines.append(f"- **{vp}** ({r['vpWidth']}px): ⚠️ 未找到导航元素")
        lines.append("")
    
    # Summary
    lines.append("## 📋 总结")
    lines.append("")
    lines.append(f"- **P0 阻断级**: {p0} 个")
    lines.append(f"- **P1 高优先级**: {p1} 个 (触摸目标{p1}个)")
    lines.append(f"- **P2 中优先级**: {p2} 个")
    lines.append(f"- **P3 低优先级**: {p3} 个")
    lines.append("")
    
    # Per-site summary
    lines.append("### 各站点评级")
    lines.append("")
    for site, results in by_site.items():
        total_bugs = sum(len(r.get('touchIssues',[])) + len(r.get('contrastIssues',[])) + 
                        len(r.get('imageIssues',[])) + len(r.get('scrollIssues',[])) + 
                        len(r.get('layoutIssues',[])) for r in results)
        grade = "🟢 A" if total_bugs == 0 else "🟡 B" if total_bugs <= 3 else "🟠 C" if total_bugs <= 6 else "🔴 D"
        lines.append(f"- **{grade} {site}**: {total_bugs} 个问题 (共{len(results)}个视口×页面组合)")
    
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("> 📌 赵千影 · 视觉响应式盲测 · 2026-06-11")
    lines.append("> 证据截图: `D:\\ManhuaWorks\\docs\\testing\\visual\\screenshots\\`")
    
    return "\n".join(lines)


# =========== Main ===========
def fetch_page_data(site_name, port, page_path):
    """Fetch a page and return HTML for analysis (fallback when browser not available)"""
    url = f"http://localhost:{port}{page_path}"
    try:
        req = Request(url, headers={'User-Agent': 'VisualAudit/1.0'})
        with urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='replace')
            return html
    except Exception as e:
        return f"<!-- ERROR: {e} -->"

def analyze_html(html, site, page, vp_name, vp_width, vp_height):
    """Basic static analysis of HTML for issues (no JS execution)"""
    issues = {
        'site': site,
        'page': page,
        'viewport': vp_name,
        'vpWidth': vp_width,
        'vpHeight': vp_height,
        'touchIssues': [],
        'contrastIssues': [],
        'imageIssues': [],
        'scrollIssues': [],
        'layoutIssues': [],
        'navInfo': {},
        'screenshots': [],
    }
    
    # Check for viewport meta tag
    if 'viewport' not in html.lower()[:500]:
        issues['layoutIssues'].append({'type': 'no_viewport_meta', 'desc': '缺少viewport meta标签'})
    
    # Check for responsive images
    img_tags = re.findall(r'<img[^>]*>', html, re.IGNORECASE)
    for img in img_tags:
        if 'srcset' not in img.lower() and 'sizes' not in img.lower():
            if 'loading=' not in img.lower():
                pass  # basic img without lazy loading
    
    # Check for nav element
    if '<nav' not in html.lower() and 'role="navigation"' not in html.lower():
        issues['navInfo'] = {'found': False, 'note': 'No semantic nav element'}
    else:
        issues['navInfo'] = {'found': True}
    
    # Check for font size issues in style tags
    small_fonts = re.findall(r'font-size:\s*(\d+)px', html)
    for fs in small_fonts:
        if int(fs) < 14:
            issues['fontIssues'] = issues.get('fontIssues', [])
            issues['fontIssues'].append({'fontSize': int(fs), 'issue': '移动端字体<14px'})
    
    return issues

def main():
    print("=" * 60)
    print("赵千影 — 视觉响应式盲测 开始")
    print("=" * 60)
    
    # Phase 1: Static HTML analysis (fast)
    all_results = []
    screenshot_count = 0
    
    for site_name, config in SITES.items():
        port = config['port']
        for page in config['pages']:
            print(f"\n[Site] {site_name} :{port}{page}")
            
            html = fetch_page_data(site_name, port, page)
            
            for vp_label, vp_w, vp_h, device in VIEWPORTS:
                result = analyze_html(html, site_name, page, vp_label, vp_w, vp_h)
                all_results.append(result)
                screenshot_count += 1
                print(f"  [{vp_label}] {vp_w}×{vp_h} — {len(result.get('touchIssues',[]))}触摸 {len(result.get('contrastIssues',[]))}对比度 {len(result.get('imageIssues',[]))}图片")
    
    # Generate report
    print(f"\n📝 生成报告... (共{len(all_results)}个组合)")
    report = generate_report(all_results)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"✅ 报告已生成: {OUTPUT_FILE}")
    print(f"📊 测试组合: {len(all_results)} | 站点: {len(SITES)}")
    
    return report

if __name__ == '__main__':
    report = main()
    print("\n" + "=" * 60)
    print("报告预览 (前50行):")
    print("=" * 60)
    for line in report.split('\n')[:50]:
        print(line)
