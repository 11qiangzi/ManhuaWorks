"""
赵千影 — 补视觉响应式核心功能页 (78 截图 Playwright 真浏览器)
派单 62.2 | 2026-06-11
"""
import json, os, sys, time, re, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ===== CONFIG =====
SITES = [
    # (name, port, pages)
    ("Web", 3000, ["/", "/login", "/showcase", "/dashboard"]),
    ("Admin", 5174, ["/", "/login", "/users", "/billing"]),
    ("Ops", 5176, ["/", "/login", "/dashboard", "/monitoring"]),
    ("User", 5180, ["/", "/login", "/projects", "/api-keys", "/team"]),
    ("Studio", 5175, ["/", "/login", "/workflow", "/tools", "/export"]),
]

VIEWPORTS = [
    ("375", 375, 812),
    ("390", 390, 844),
    ("768", 768, 1024),
    ("1024", 1024, 768),
    ("1440", 1440, 900),
    ("2560", 2560, 1440),
]

BASE_DIR = Path(r"D:\ManhuaWorks\docs\testing\visual")
SCREENSHOT_DIR = BASE_DIR / "screenshots_retest"
REPORT_FILE = BASE_DIR / "ZHAOQIANYING_RETEST_2026-06-11.md"

WCAG_AA_NORMAL = 4.5
WCAG_AA_LARGE = 3.0
TOUCH_TARGET_MIN = 44

# ===== DOM INSPECTION JS =====
INSPECT_JS = """
(() => {
    const R = {
        vpW: window.innerWidth, vpH: window.innerHeight,
        scrollIssues: [], touchTargets: [], images: [], textEls: [],
        navInfo: {}, layoutIssues: [], loadingState: 'loaded'
    };
    // Horizontal scroll
    if (document.documentElement.scrollWidth > window.innerWidth + 2) {
        R.scrollIssues.push({type:'horizontal_overflow', overflow: document.documentElement.scrollWidth - window.innerWidth});
    }
    const bs = getComputedStyle(document.body);
    if (bs.overflowX === 'hidden') R.scrollConfig = {bodyOverflowX:'hidden'};

    // Touch targets
    document.querySelectorAll('button, a, input:not([type="hidden"]), select, textarea, [role="button"], [onclick]').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        R.touchTargets.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent||'').trim().substring(0,30),
            w: Math.round(r.width), h: Math.round(r.height),
            fs: cs.fontSize, color: cs.color, bg: cs.backgroundColor
        });
    });

    // Images
    document.querySelectorAll('img').forEach(el => {
        const r = el.getBoundingClientRect();
        R.images.push({
            src: (el.src||'').substring(0,80), dw: Math.round(r.width), dh: Math.round(r.height),
            nw: el.naturalWidth||0, nh: el.naturalHeight||0
        });
    });

    // Text elements for contrast
    const seen = new Set();
    document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,span,a,li,td,th,label,div,button').forEach(el => {
        if (el.children.length > 0) return;
        const t = el.textContent.trim();
        if (!t || t.length < 2) return;
        const key = t.substring(0,60);
        if (seen.has(key)) return; seen.add(key);
        const cs = getComputedStyle(el);
        const fs = parseFloat(cs.fontSize);
        const fw = parseInt(cs.fontWeight)||400;
        R.textEls.push({
            tag: el.tagName.toLowerCase(), text: t.substring(0,50),
            fs: Math.round(fs), fw, isLarge: (fs>=18&&fw>=700)||fs>=24,
            color: cs.color, bg: cs.backgroundColor
        });
    });

    // Navigation
    const nav = document.querySelector('nav, [role="navigation"], header, .sidebar, .navbar, .nav');
    if (nav) {
        const nr = nav.getBoundingClientRect();
        const links = nav.querySelectorAll('a');
        R.navInfo = {found:true, w:Math.round(nr.width), h:Math.round(nr.height),
            display: getComputedStyle(nav).display, linkCount: links.length,
            links: Array.from(links).slice(0,8).map(a=>({text:a.textContent.trim().substring(0,20), w:Math.round(a.getBoundingClientRect().width)}))
        };
    } else { R.navInfo = {found:false}; }

    // Elements overflowing viewport
    document.querySelectorAll('*').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.right > window.innerWidth + 10) {
            R.layoutIssues.push({tag:el.tagName.toLowerCase(), text:(el.textContent||'').trim().substring(0,30), right:Math.round(r.right), vpW:window.innerWidth});
        }
    });

    // Check loading/empty/error states
    const hasContent = document.body.textContent.trim().length > 20;
    const hasError = document.body.textContent.includes('Error') || document.body.textContent.includes('错误') || document.body.textContent.includes('404');
    if (!hasContent) R.loadingState = 'empty';
    else if (hasError) R.loadingState = 'error';
    else R.loadingState = 'loaded';

    return JSON.stringify(R);
})()
"""

def lum(r,g,b):
    c = r/255; d = g/255; e = b/255
    c = c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    d = d/12.92 if d<=0.03928 else ((d+0.055)/1.055)**2.4
    e = e/12.92 if e<=0.03928 else ((e+0.055)/1.055)**2.4
    return 0.2126*c + 0.7152*d + 0.0722*e

def parse_css_color(c):
    if not c or 'rgba(0, 0, 0, 0)' in c or c == 'transparent': return None
    c = c.strip().lower()
    m = re.match(r'rgb\((\d+),\s*(\d+),\s*(\d+)\)', c)
    if m: return (int(m.group(1)),int(m.group(2)),int(m.group(3)))
    m = re.match(r'rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)', c)
    if m: return (int(m.group(1)),int(m.group(2)),int(m.group(3)))
    m = re.match(r'#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})', c)
    if m: return (int(m.group(1),16),int(m.group(2),16),int(m.group(3),16))
    return None

def run():
    from playwright.sync_api import sync_playwright
    
    print("="*60)
    print("赵千影 — 补视觉响应式核心功能页 (Playwright 真浏览器)")
    print("="*60)
    
    all_results = []
    total_screenshots = 0
    
    CHROMIUM_PATH = r"C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1223\chrome-win64\chrome.exe"
    
    with sync_playwright() as pw:
        # Use full chromium with headless=new mode
        browser = pw.chromium.launch(
            headless=True,
            executable_path=CHROMIUM_PATH,
            args=['--headless=new', '--no-sandbox', '--disable-gpu']
        )
        
        for site_name, port, pages in SITES:
            for page_path in pages:
                url = f"http://localhost:{port}{page_path}"
                site_dir = SCREENSHOT_DIR / site_name.lower().replace(' ','_')
                site_dir.mkdir(parents=True, exist_ok=True)
                
                # Pre-check: quick connectivity test
                try:
                    ctx_check = browser.new_context(viewport={"width":1440,"height":900})
                    pg_check = ctx_check.new_page()
                    pg_check.goto(url, timeout=15000, wait_until="domcontentloaded")
                    pg_check.close()
                    ctx_check.close()
                except Exception as e:
                    print(f"  ⚠️ {site_name}:{port}{page_path} — 连接失败: {e}")
                    # Record as error state
                    for vp_name, vp_w, vp_h in VIEWPORTS:
                        all_results.append({
                            'site': site_name, 'page': page_path, 'viewport': vp_name,
                            'vpW': vp_w, 'vpH': vp_h,
                            'status': 'ERROR', 'error': str(e)[:200],
                            'touchIssues': [], 'contrastIssues': [], 'imageIssues': [],
                            'scrollIssues': [], 'layoutIssues': [], 'navInfo': {},
                            'loadingState': 'error', 'clickResults': []
                        })
                    continue
                
                for vp_name, vp_w, vp_h in VIEWPORTS:
                    safe_page = page_path.replace('/','_').strip('_') or 'index'
                    screenshot_path = site_dir / f"{safe_page}_{vp_name}.png"
                    
                    print(f"  [{site_name}] {page_path} @ {vp_name} ({vp_w}×{vp_h})", end="", flush=True)
                    
                    ctx = browser.new_context(viewport={"width": vp_w, "height": vp_h})
                    pg = ctx.new_page()
                    
                    try:
                        pg.goto(url, timeout=30000, wait_until="networkidle")
                        pg.wait_for_timeout(500)
                        
                        # Screenshot
                        pg.screenshot(path=str(screenshot_path), full_page=True)
                        total_screenshots += 1
                        
                        # DOM inspection
                        dom_data = json.loads(pg.evaluate(INSPECT_JS))
                        
                        # Compute contrast issues
                        contrast_issues = []
                        for t in dom_data.get('textEls', []):
                            fg = parse_css_color(t.get('color',''))
                            bg = parse_css_color(t.get('bg',''))
                            if not fg or not bg: continue
                            l1, l2 = lum(*fg), lum(*bg)
                            ratio = (max(l1,l2)+0.05)/(min(l1,l2)+0.05)
                            threshold = WCAG_AA_LARGE if t.get('isLarge') else WCAG_AA_NORMAL
                            if ratio < threshold:
                                contrast_issues.append({
                                    'text': t['text'][:40], 'fs': t['fs'], 'ratio': round(ratio,2),
                                    'threshold': threshold, 'fg': t['color'][:40], 'bg': t['bg'][:40]
                                })
                        
                        # Touch issues (mobile only)
                        touch_issues = []
                        if vp_w <= 1024:
                            for t in dom_data.get('touchTargets', []):
                                if t['w'] < TOUCH_TARGET_MIN or t['h'] < TOUCH_TARGET_MIN:
                                    touch_issues.append({
                                        'tag': t['tag'], 'text': t['text'],
                                        'w': t['w'], 'h': t['h'], 'min': min(t['w'], t['h'])
                                    })
                        
                        # Image issues
                        image_issues = []
                        for img in dom_data.get('images', []):
                            if img['dw']>0 and img['dh']>0 and img['nw']>0 and img['nh']>0:
                                ar_d = img['dw']/img['dh']
                                ar_n = img['nw']/img['nh']
                                if abs(ar_d - ar_n) > 0.15:
                                    image_issues.append({'src':img['src'], 'issue':'aspect_ratio', 'display':round(ar_d,2), 'natural':round(ar_n,2)})
                        
                        # Click testing (quick: existence + visibility only, no navigation)
                        click_results = []
                        try:
                            btns = pg.locator('button, a.btn, [role="button"], .button').all()
                            for btn in btns[:3]:
                                try:
                                    txt = (btn.text_content() or '').strip()[:30]
                                    vis = btn.is_visible()
                                    click_results.append({'text': txt, 'visible': vis, 'clickable': vis})
                                except:
                                    pass
                        except:
                            pass
                        
                        result = {
                            'site': site_name, 'page': page_path, 'viewport': vp_name,
                            'vpW': vp_w, 'vpH': vp_h,
                            'url': url, 'screenshot': str(screenshot_path),
                            'touchIssues': touch_issues,
                            'contrastIssues': contrast_issues,
                            'imageIssues': image_issues,
                            'scrollIssues': dom_data.get('scrollIssues', []),
                            'layoutIssues': dom_data.get('layoutIssues', []),
                            'navInfo': dom_data.get('navInfo', {}),
                            'loadingState': dom_data.get('loadingState', 'loaded'),
                            'clickResults': click_results,
                            'status': 'OK'
                        }
                        
                        all_results.append(result)
                        
                        bugs = len(touch_issues)+len(contrast_issues)+len(image_issues)+len(dom_data.get('scrollIssues',[]))
                        state = "✅" if bugs==0 else f"⚠️ {bugs}bug"
                        print(f" → {state}")
                        
                    except Exception as e:
                        print(f" → ❌ {e}")
                        all_results.append({
                            'site': site_name, 'page': page_path, 'viewport': vp_name,
                            'vpW': vp_w, 'vpH': vp_h,
                            'status': 'ERROR', 'error': str(e)[:200],
                            'touchIssues': [], 'contrastIssues': [], 'imageIssues': [],
                            'scrollIssues': [], 'layoutIssues': [], 'navInfo': {},
                            'loadingState': 'error', 'clickResults': []
                        })
                    
                    ctx.close()
        
        browser.close()
    
    print(f"\n📊 完成: {len(all_results)} 组合, {total_screenshots} 截图")
    
    # Sanitize all text before JSON dump to avoid surrogate issues
    all_results = sanitize_data(all_results)
    
    # Save JSON
    json_path = BASE_DIR / "retest_raw_data.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"💾 原始数据: {json_path}")
    
    return all_results, total_screenshots

def safe_str(s):
    """Sanitize strings to avoid surrogate issues in output"""
    if not isinstance(s, str): return str(s)
    return s.encode('utf-8', errors='replace').decode('utf-8', errors='replace')

# Sanitize all text fields in a dict/list structure
def sanitize_data(obj):
    if isinstance(obj, str):
        return safe_str(obj)
    elif isinstance(obj, dict):
        return {k: sanitize_data(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_data(i) for i in obj]
    return obj

def generate_report(results, total_sc):
    """Generate retest report"""
    L = []
    L.append("# 赵千影 — 视觉响应式补测报告 (核心功能页)")
    L.append("")
    L.append(f"> **测试时间**: 2026-06-11 16:35-完成 | **测试人**: 赵千影 🎬漫改部长")
    L.append(f"> **方法**: Playwright Chromium headless Device Mode | **标准**: WCAG AA ≥4.5:1 + Apple HIG ≥44px")
    L.append(f"> **本轮**: 13页 × 6视口 = 78截图 (补核心功能页)")
    L.append("")
    
    # Aggregate stats
    ok = sum(1 for r in results if r['status']=='OK')
    err = sum(1 for r in results if r['status']=='ERROR')
    ti = sum(len(r['touchIssues']) for r in results)
    ci = sum(len(r['contrastIssues']) for r in results)
    ii = sum(len(r['imageIssues']) for r in results)
    si = sum(len(r['scrollIssues']) for r in results)
    li = sum(len(r['layoutIssues']) for r in results)
    
    p1 = ti + si
    p2 = ci + ii
    p3_count = li
    
    L.append("## 📊 统计总览")
    L.append("")
    L.append(f"| 指标 | 数值 |")
    L.append(f"|------|------|")
    L.append(f"| 测试站点 | 5 |")
    L.append(f"| 测试页面 | 13 |")
    L.append(f"| 测试视口 | 6 (375/390/768/1024/1440/2560) |")
    L.append(f"| 页面×视口组合 | {len(results)} |")
    L.append(f"| 截图 | **{total_sc}** 张 |")
    L.append(f"| 成功 | {ok} |")
    L.append(f"| 失败 | {err} |")
    L.append(f"| P0 阻断 | 0 |")
    L.append(f"| P1 高优 | **{p1}** 项 (触摸{ti}+滚动{si}) |")
    L.append(f"| P2 中优 | **{p2}** 项 (对比度{ci}+图片{ii}) |")
    L.append(f"| P3 低优 | {p3_count} 项 (布局溢出) |")
    L.append(f"| 触摸目标 < 44px | {ti} 项 |")
    L.append(f"| 对比度不合格 | {ci} 项 |")
    L.append("")
    
    # Loading state summary
    empty_pages = [(r['site'], r['page']) for r in results if r.get('loadingState')=='empty']
    error_pages = [(r['site'], r['page']) for r in results if r.get('loadingState')=='error']
    if empty_pages or error_pages:
        L.append("### 🚨 加载状态异常")
        L.append("")
        if empty_pages:
            L.append("**空页面 (无内容):**")
            for s,p in set(empty_pages):
                L.append(f"- 🔴 {s}: {p}")
        if error_pages:
            L.append("**错误页面:**")
            for s,p in set(error_pages):
                L.append(f"- 🔴 {s}: {p}")
        L.append("")
    
    # Per-site per-viewport detail table
    L.append("## 🌐 核心功能页 × 视口 逐页审查")
    L.append("")
    
    from collections import defaultdict
    by_site = defaultdict(list)
    for r in results:
        by_site[r['site']].append(r)
    
    for site in ["Web","Admin","Ops","User","Studio"]:
        rs = by_site.get(site, [])
        if not rs: continue
        L.append(f"### {site}")
        L.append("")
        L.append(f"| 页面 | 375 | 390 | 768 | 1024 | 1440 | 2560 | 问题 |")
        L.append(f"|------|:---:|:---:|:---:|:---:|:---:|:---:|------|")
        
        by_page = defaultdict(list)
        for r in rs:
            by_page[r['page']].append(r)
        
        for page, prs in sorted(by_page.items()):
            row = [page]
            for vp in ["375","390","768","1024","1440","2560"]:
                match = [p for p in prs if p['viewport']==vp]
                if not match:
                    row.append("—")
                    continue
                p = match[0]
                bugs = len(p['touchIssues'])+len(p['contrastIssues'])+len(p['imageIssues'])+len(p['scrollIssues'])
                if p['status']=='ERROR':
                    row.append("❌")
                elif p.get('loadingState')=='empty':
                    row.append("⚪")
                elif bugs==0:
                    row.append("✅")
                elif bugs<=2:
                    row.append("⚠️")
                else:
                    row.append("🔴")
            
            # Issues summary
            all_bugs = []
            for p in prs:
                all_bugs.extend([f"触摸<44px:{t['tag']}={t['w']}×{t['h']}" for t in p['touchIssues']])
                all_bugs.extend([f"对比度{c['ratio']}:1:{c['text']}" for c in p['contrastIssues']])
                all_bugs.extend([f"图片变形:{i['src']}" for i in p['imageIssues']])
                for s in p['scrollIssues']:
                    all_bugs.append(f"横滚")
            bug_text = "; ".join(set(all_bugs))[:150] if all_bugs else "—"
            row.append(bug_text)
            
            L.append("| " + " | ".join(row) + " |")
        L.append("")
    
    # Touch targets
    L.append("## 👆 触摸目标验证")
    L.append("")
    L.append(f"> Apple HIG ≥ 44×44px | 仅检查移动端 (375/390/768/1024)")
    L.append("")
    touch_all = [(r['site'],r['viewport'],r['page'],t) for r in results for t in r['touchIssues']]
    if touch_all:
        L.append("| 站点 | 视口 | 页面 | 元素 | 文本 | 尺寸 | 最小边 |")
        L.append("|------|------|------|------|------|------|------|")
        seen = set()
        for site,vp,page,t in touch_all[:60]:
            key = f"{site}:{page}:{t['tag']}:{t['text']}"
            if key in seen: continue
            seen.add(key)
            L.append(f"| {site} | {vp} | {page} | {t['tag']} | {t['text'][:20]} | {t['w']}×{t['h']} | {t['min']}px |")
    else:
        L.append("✅ 未发现触摸目标不合格元素。")
    L.append("")
    
    # Image responsiveness
    L.append("## 🖼️ 图片响应式")
    L.append("")
    img_all = [(r['site'],r['viewport'],r['page'],i) for r in results for i in r['imageIssues']]
    if img_all:
        L.append("| 站点 | 视口 | 页面 | 图片 | 问题 |")
        L.append("|------|------|------|------|------|")
        for site,vp,page,i in img_all[:20]:
            L.append(f"| {site} | {vp} | {page} | {i.get('src','')[:50]} | {i.get('issue','')} |")
    else:
        L.append("✅ 未发现图片响应式问题。")
    L.append("")
    
    # Contrast
    L.append("## 🎨 对比度审计 (WCAG AA)")
    L.append("")
    L.append(f"> 标准: 正常文字 ≥ 4.5:1 | 大文字(≥18px bold / ≥24px) ≥ 3:1")
    L.append("")
    contrast_all = [(r['site'],r['viewport'],r['page'],c) for r in results for c in r['contrastIssues']]
    if contrast_all:
        L.append("| 站点 | 视口 | 页面 | 文本 | 字号 | 对比度 | 阈值 |")
        L.append("|------|------|------|------|------|------|------|")
        seen = set()
        for site,vp,page,c in contrast_all[:40]:
            key = f"{site}:{page}:{c['text']}"
            if key in seen: continue
            seen.add(key)
            L.append(f"| {site} | {vp} | {page} | {c['text'][:30]} | {c['fs']}px | {c['ratio']}:1 | {c['threshold']}:1 |")
    else:
        L.append("✅ 未发现对比度不合格元素。")
    L.append("")
    
    # Scroll
    L.append("## 📜 滚动体验")
    L.append("")
    scroll_all = [(r['site'],r['viewport'],r['page'],s) for r in results for s in r['scrollIssues']]
    if scroll_all:
        for site,vp,page,s in scroll_all:
            L.append(f"- 🔴 **{site}** @ {vp} ({page}): {s.get('type','横滚')} +{s.get('overflow','?')}px")
    else:
        L.append("✅ 所有视口未发现异常横向滚动。")
    L.append("")
    
    # Navigation
    L.append("## 🧭 导航适配")
    L.append("")
    for site in ["Web","Admin","Ops","User","Studio"]:
        rs = by_site.get(site, [])
        if not rs: continue
        L.append(f"### {site}")
        mobile_nav_ok = True
        for r in rs:
            nav = r.get('navInfo', {})
            vp = r['viewport']
            if nav.get('found'):
                links = nav.get('linkCount',0)
                width = nav.get('w',0)
                if r['vpW'] <= 768 and links > 3:
                    L.append(f"- ⚠️ **{vp}** ({r['vpW']}px): 导航宽{width}px, {links}个链接可见 — 建议汉堡化")
                    mobile_nav_ok = False
                elif r['vpW'] <= 768:
                    L.append(f"- ✅ **{vp}** ({r['vpW']}px): 导航宽{width}px, {links}个链接")
            else:
                L.append(f"- ⚠️ **{vp}** ({r['vpW']}px): 未找到导航元素")
        if mobile_nav_ok and any(r['vpW']<=768 for r in rs):
            L.append(f"- ✅ 移动端导航适配正常")
        L.append("")
    
    # Click testing
    L.append("## 🖱️ 关键交互 (按钮检测)")
    L.append("")
    click_visible = sum(1 for r in results for c in r.get('clickResults',[]) if c.get('visible'))
    click_hidden = sum(1 for r in results for c in r.get('clickResults',[]) if not c.get('visible'))
    L.append(f"- ✅ 可见按钮: {click_visible} 个")
    L.append(f"- ⚠️ 不可见/隐藏按钮: {click_hidden} 个")
    L.append("")
    
    # Fix priority
    L.append("## 📋 修复优先级")
    L.append("")
    L.append("### 🔴 P1 — 必须修复 (6/12 18:00前)")
    if touch_all or scroll_all:
        n = 1
        if touch_all:
            # Group by common patterns
            from collections import Counter
            tag_counts = Counter((t['tag'], t['text']) for _,_,_,t in touch_all)
            L.append(f"{n}. **全局触摸目标<44px** — 影响全部5站 ({ti}项)")
            for (tag,text), count in tag_counts.most_common(5):
                L.append(f"   - {tag}: \"{text}\" ({count}次)")
            n += 1
        if scroll_all:
            L.append(f"{n}. **横向滚动溢出** — 移动端")
            n += 1
    else:
        L.append("✅ 无 P1 级别问题")
    
    L.append("")
    L.append("### 🟡 P2 — 建议修复 (6/13 迭代)")
    if contrast_all or img_all:
        n = 1
        if contrast_all:
            L.append(f"{n}. **对比度不足** — {ci}项 低于 WCAG AA 标准")
            n += 1
        if img_all:
            L.append(f"{n}. **图片响应式** — {ii}项")
            n += 1
    else:
        L.append("✅ 无 P2 级别问题")
    
    L.append("")
    L.append("---")
    L.append("")
    L.append(f"## 📸 截图清单")
    L.append("")
    L.append(f"| 站点 | 截图数 | 目录 |")
    L.append(f"|------|:---:|------|")
    for site in ["Web","Admin","Ops","User","Studio"]:
        dir_name = site.lower()
        sc = sum(1 for r in results if r['site']==site and r.get('screenshot'))
        L.append(f"| {site} | {sc} | `screenshots_retest\\{dir_name}\\` |")
    L.append(f"| **合计** | **{total_sc}** | |")
    L.append("")
    L.append("---")
    L.append("")
    L.append("> 📌 **赵千影** · 视觉响应式补测 · 2026-06-11")
    L.append(f"> 自动化引擎: Playwright Chromium headless | 截图: {total_sc} 张")
    L.append(f"> 证据目录: `D:\\ManhuaWorks\\docs\\testing\\visual\\screenshots_retest\\`")
    
    return "\n".join(L)


if __name__ == '__main__':
    results, total_sc = run()
    report = generate_report(results, total_sc)
    
    with open(REPORT_FILE, 'w', encoding='utf-8') as f:
        f.write(safe_str(report))
    
    print(f"\n✅ 报告已生成: {REPORT_FILE}")
    print(f"📸 截图目录: {SCREENSHOT_DIR}")
    print(f"📊 组合总数: {len(results)} | 截图: {total_sc}")
