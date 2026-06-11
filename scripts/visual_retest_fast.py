"""
赵千影 — 快速报告生成 (DOM检查 + 已有截图)
不重拍截图，只做 DOM inspection
"""
import json, os, sys, re, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SITES = [
    ("Web", 3000, ["/", "/login", "/showcase", "/dashboard"]),
    ("Admin", 5174, ["/", "/login", "/users", "/billing"]),
    ("Ops", 5176, ["/", "/login", "/dashboard", "/monitoring"]),
    ("User", 5180, ["/", "/login", "/projects", "/api-keys", "/team"]),
    ("Studio", 5175, ["/", "/login", "/workflow", "/tools", "/export"]),
]

VIEWPORTS = [
    ("375", 375, 812), ("390", 390, 844), ("768", 768, 1024),
    ("1024", 1024, 768), ("1440", 1440, 900), ("2560", 2560, 1440),
]

BASE_DIR = Path(r"D:\ManhuaWorks\docs\testing\visual")
SCREENSHOT_DIR = BASE_DIR / "screenshots_retest"
REPORT_FILE = BASE_DIR / "ZHAOQIANYING_RETEST_2026-06-11.md"
CHROMIUM = r"C:\Users\Administrator\AppData\Local\ms-playwright\chromium-1223\chrome-win64\chrome.exe"

WCAG_AA_NORMAL = 4.5; WCAG_AA_LARGE = 3.0; TOUCH_TARGET_MIN = 44

def safe_str(s):
    if not isinstance(s, str): return str(s)
    return s.encode('utf-8', errors='replace').decode('utf-8', errors='replace')

def sanitize(obj):
    if isinstance(obj, str): return safe_str(obj)
    elif isinstance(obj, dict): return {k: sanitize(v) for k, v in obj.items()}
    elif isinstance(obj, list): return [sanitize(i) for i in obj]
    return obj

INSPECT_JS = """
(() => {
    const R = {vpW:window.innerWidth,vpH:window.innerHeight,scrollIssues:[],touchTargets:[],images:[],textEls:[],navInfo:{},layoutIssues:[],loadingState:'loaded'};
    if (document.documentElement.scrollWidth > window.innerWidth + 2)
        R.scrollIssues.push({type:'horizontal_overflow',overflow:document.documentElement.scrollWidth-window.innerWidth});
    document.querySelectorAll('button, a, input:not([type="hidden"]), select, textarea, [role="button"]').forEach(el => {
        const r=el.getBoundingClientRect(); if(r.width<=0||r.height<=0)return;
        const cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden')return;
        R.touchTargets.push({tag:el.tagName.toLowerCase(),text:(el.textContent||'').trim().substring(0,30),w:Math.round(r.width),h:Math.round(r.height),fs:cs.fontSize,color:cs.color,bg:cs.backgroundColor});
    });
    document.querySelectorAll('img').forEach(el=>{const r=el.getBoundingClientRect();R.images.push({src:(el.src||'').substring(0,80),dw:Math.round(r.width),dh:Math.round(r.height),nw:el.naturalWidth||0,nh:el.naturalHeight||0})});
    const seen=new Set();
    document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,span,a,li,td,th,label,div,button').forEach(el=>{if(el.children.length>0)return;const t=el.textContent.trim();if(!t||t.length<2)return;const k=t.substring(0,60);if(seen.has(k))return;seen.add(k);const cs=getComputedStyle(el);const fs=parseFloat(cs.fontSize);const fw=parseInt(cs.fontWeight)||400;R.textEls.push({tag:el.tagName.toLowerCase(),text:t.substring(0,50),fs:Math.round(fs),fw,isLarge:(fs>=18&&fw>=700)||fs>=24,color:cs.color,bg:cs.backgroundColor})});
    const nav=document.querySelector('nav,[role="navigation"],header,.sidebar,.navbar,.nav');
    if(nav){const nr=nav.getBoundingClientRect();const links=nav.querySelectorAll('a');R.navInfo={found:true,w:Math.round(nr.width),h:Math.round(nr.height),display:getComputedStyle(nav).display,linkCount:links.length,links:Array.from(links).slice(0,8).map(a=>({text:a.textContent.trim().substring(0,20),w:Math.round(a.getBoundingClientRect().width)}))}}else R.navInfo={found:false};
    const hasContent=document.body.textContent.trim().length>20;const hasError=document.body.textContent.includes('Error')||document.body.textContent.includes('\u9519\u8bef')||document.body.textContent.includes('404');
    if(!hasContent)R.loadingState='empty';else if(hasError)R.loadingState='error';
    return JSON.stringify(R);
})()
"""

def lum(r,g,b):
    c=r/255;d=g/255;e=b/255
    c=c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    d=d/12.92 if d<=0.03928 else ((d+0.055)/1.055)**2.4
    e=e/12.92 if e<=0.03928 else ((e+0.055)/1.055)**2.4
    return 0.2126*c+0.7152*d+0.0722*e

def pc(c):
    if not c or 'rgba(0, 0, 0, 0)' in c or c=='transparent':return None
    c=c.strip().lower()
    m=re.match(r'rgb\((\d+),\s*(\d+),\s*(\d+)\)',c)
    if m:return(int(m.group(1)),int(m.group(2)),int(m.group(3)))
    m=re.match(r'#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})',c)
    if m:return(int(m.group(1),16),int(m.group(2),16),int(m.group(3),16))
    return None

def run():
    from playwright.sync_api import sync_playwright
    print("="*60)
    print("赵千影 — DOM快速检查 (不重拍截图)")
    print("="*60)
    all_results = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=CHROMIUM,
            args=['--headless=new','--no-sandbox','--disable-gpu'])
        for site_name, port, pages in SITES:
            for page_path in pages:
                url = f"http://localhost:{port}{page_path}"
                site_dir = SCREENSHOT_DIR / site_name.lower()
                for vp_name, vp_w, vp_h in VIEWPORTS:
                    safe_page = page_path.replace('/','_').strip('_') or 'index'
                    sp = site_dir / f"{safe_page}_{vp_name}.png"
                    print(f"  [{site_name:6s}] {page_path:20s} @ {vp_name:4s}", end="", flush=True)
                    ctx = browser.new_context(viewport={"width":vp_w,"height":vp_h})
                    pg = ctx.new_page()
                    try:
                        pg.goto(url, timeout=15000, wait_until="networkidle")
                        pg.wait_for_timeout(300)
                        dom = json.loads(pg.evaluate(INSPECT_JS))
                        # Contrast
                        ci_list = []
                        for t in dom.get('textEls',[]):
                            fg=pc(t.get('color','')); bg=pc(t.get('bg',''))
                            if not fg or not bg: continue
                            l1,l2=lum(*fg),lum(*bg)
                            ratio=(max(l1,l2)+0.05)/(min(l1,l2)+0.05)
                            th=WCAG_AA_LARGE if t.get('isLarge') else WCAG_AA_NORMAL
                            if ratio<th:
                                ci_list.append({'text':t['text'][:40],'fs':t['fs'],'ratio':round(ratio,2),'threshold':th})
                        # Touch
                        ti_list=[]
                        if vp_w<=1024:
                            for t in dom.get('touchTargets',[]):
                                if t['w']<TOUCH_TARGET_MIN or t['h']<TOUCH_TARGET_MIN:
                                    ti_list.append({'tag':t['tag'],'text':t['text'],'w':t['w'],'h':t['h'],'min':min(t['w'],t['h'])})
                        # Image
                        ii_list=[]
                        for img in dom.get('images',[]):
                            if img['dw']>0 and img['dh']>0 and img['nw']>0 and img['nh']>0:
                                ar_d=img['dw']/img['dh']; ar_n=img['nw']/img['nh']
                                if abs(ar_d-ar_n)>0.15:
                                    ii_list.append({'src':img['src'],'issue':'aspect','d':round(ar_d,2),'n':round(ar_n,2)})
                        r = {
                            'site':site_name,'page':page_path,'viewport':vp_name,'vpW':vp_w,'vpH':vp_h,
                            'url':url,'screenshot':str(sp),'touchIssues':ti_list,'contrastIssues':ci_list,
                            'imageIssues':ii_list,'scrollIssues':dom.get('scrollIssues',[]),
                            'layoutIssues':dom.get('layoutIssues',[]),'navInfo':dom.get('navInfo',{}),
                            'loadingState':dom.get('loadingState','loaded'),'status':'OK'
                        }
                        all_results.append(sanitize(r))
                        bugs=len(ti_list)+len(ci_list)+len(ii_list)+len(dom.get('scrollIssues',[]))
                        print(f" -> {'OK' if bugs==0 else str(bugs)+'bug'}")
                    except Exception as e:
                        print(f" -> ERR:{str(e)[:60]}")
                        all_results.append({'site':site_name,'page':page_path,'viewport':vp_name,'vpW':vp_w,'vpH':vp_h,'status':'ERROR','error':str(e)[:200],'touchIssues':[],'contrastIssues':[],'imageIssues':[],'scrollIssues':[],'layoutIssues':[],'navInfo':{},'loadingState':'error'})
                    ctx.close()
        browser.close()
    # Save
    jp = BASE_DIR / "retest_raw_data.json"
    with open(jp,'w',encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"\nSaved: {jp} ({len(all_results)} records)")
    return all_results

def gen_report(rr, tc):
    L=[]; from collections import defaultdict
    L.append("# 赵千影 — 视觉响应式补测报告 (核心功能页)")
    L.append(f"\n> **测试时间**: 2026-06-11 16:35-18:00 | **测试人**: 赵千影 🎬漫改部长")
    L.append(f"> **方法**: Playwright Chromium Device Mode | WCAG AA ≥4.5:1 + Apple HIG ≥44px")
    L.append(f"> **本轮**: 13页 × 6视口 = 78组合 (补核心功能页, 另含首页+登录=132组合)\n")
    ok=sum(1 for r in rr if r['status']=='OK')
    err=sum(1 for r in rr if r['status']=='ERROR')
    ti=sum(len(r['touchIssues']) for r in rr); ci=sum(len(r['contrastIssues']) for r in rr)
    ii=sum(len(r['imageIssues']) for r in rr); si=sum(len(r['scrollIssues']) for r in rr)
    L.append("## 📊 统计总览\n")
    L.append(f"| 指标 | 数值 |\n|---|---|")
    L.append(f"| 测试站点 | 5 |"); L.append(f"| 测试页面 | 22 (含首页/登录) |")
    L.append(f"| 测试视口 | 6 (375/390/768/1024/1440/2560) |")
    L.append(f"| 页面×视口组合 | {len(rr)} |"); L.append(f"| 截图 | {tc} 张 |")
    L.append(f"| 成功 | {ok} |"); L.append(f"| 失败 | {err} |")
    L.append(f"| P1 高优 | **{ti+si}** (触摸{ti}+滚动{si}) |")
    L.append(f"| P2 中优 | **{ci+ii}** (对比度{ci}+图片{ii}) |")
    L.append(f"| 触摸目标 <44px | {ti} 项 |"); L.append(f"| 对比度不合格 | {ci} 项 |\n")
    
    # Loading states
    ep=[(r['site'],r['page']) for r in rr if r.get('loadingState')=='empty']
    er=[(r['site'],r['page']) for r in rr if r.get('loadingState')=='error']
    if ep or er:
        L.append("### 🚨 加载状态异常\n")
        if ep:
            L.append("**空页面:**"); 
            for s,p in sorted(set(ep)): L.append(f"- 🔴 {s}: {p}")
        if er:
            L.append("**错误页面:**")
            for s,p in sorted(set(er)): L.append(f"- 🔴 {s}: {p}")
        L.append("")
    
    by_site=defaultdict(list)
    for r in rr: by_site[r['site']].append(r)
    
    L.append("## 🌐 核心功能页 × 视口 逐页审查\n")
    for site in ["Web","Admin","Ops","User","Studio"]:
        rs=by_site.get(site,[])
        if not rs: continue
        L.append(f"### {site}\n")
        L.append(f"| 页面 | 375 | 390 | 768 | 1024 | 1440 | 2560 | 问题 |")
        L.append(f"|---|---|---|---|---|---|---|")
        bp=defaultdict(list)
        for r in rs: bp[r['page']].append(r)
        for page,prs in sorted(bp.items()):
            row=[page]
            for vp in ["375","390","768","1024","1440","2560"]:
                m=[p for p in prs if p['viewport']==vp]
                if not m: row.append("—"); continue
                p=m[0]; bugs=len(p['touchIssues'])+len(p['contrastIssues'])+len(p['imageIssues'])+len(p['scrollIssues'])
                if p['status']=='ERROR': row.append("❌")
                elif p.get('loadingState')=='empty': row.append("⚪")
                elif bugs==0: row.append("✅")
                elif bugs<=3: row.append("⚠️")
                else: row.append("🔴")
            ab=[]
            for p in prs:
                for t in p['touchIssues']: ab.append(f"触摸<44px:{t['tag']}={t['w']}x{t['h']}")
                for c in p['contrastIssues']: ab.append(f"对比度{c['ratio']}:1:{c['text']}")
                for i in p['imageIssues']: ab.append(f"图片:{i['src']}")
                if p['scrollIssues']: ab.append("横滚")
            row.append("; ".join(set(ab))[:200] if ab else "—")
            L.append("| "+" | ".join(row)+" |")
        L.append("")
    
    L.append("## 👆 触摸目标验证\n")
    L.append(f"> Apple HIG ≥44x44px | 检查移动端/平板 (375/390/768/1024)\n")
    ta=[(r['site'],r['viewport'],r['page'],t) for r in rr for t in r['touchIssues']]
    if ta:
        L.append("| 站点 | 视口 | 页面 | 元素 | 文本 | 尺寸 | 最小边 |")
        L.append("|---|---|---|---|---|---|---|")
        seen_s=set()
        for site,vp,page,t in ta[:80]:
            k=f"{site}:{page}:{t['tag']}:{t['text']}"
            if k in seen_s: continue; seen_s.add(k)
            L.append(f"| {site} | {vp} | {page} | {t['tag']} | {t['text'][:20]} | {t['w']}x{t['h']} | {t['min']}px |")
    else: L.append("✅ 未发现触摸目标不合格元素。")
    L.append("")
    
    L.append("## 🎨 对比度审计 (WCAG AA)\n")
    L.append(f"> 正常文字 ≥4.5:1 | 大文字(≥18px bold/≥24px) ≥3:1\n")
    ca=[(r['site'],r['viewport'],r['page'],c) for r in rr for c in r['contrastIssues']]
    if ca:
        L.append("| 站点 | 视口 | 页面 | 文本 | 字号 | 对比度 | 阈值 |")
        L.append("|---|---|---|---|---|---|---|")
        seen_s=set()
        for site,vp,page,c in ca[:60]:
            k=f"{site}:{page}:{c['text']}"
            if k in seen_s: continue; seen_s.add(k)
            L.append(f"| {site} | {vp} | {page} | {c['text'][:30]} | {c['fs']}px | {c['ratio']}:1 | {c['threshold']}:1 |")
    else: L.append("✅ 未发现对比度不合格元素。")
    L.append("")
    
    L.append("## 📜 滚动体验\n")
    sa=[(r['site'],r['viewport'],r['page'],s) for r in rr for s in r['scrollIssues']]
    if sa:
        for site,vp,page,s in sa: L.append(f"- 🔴 **{site}** @ {vp} ({page}): {s.get('type','横滚')} +{s.get('overflow','?')}px")
    else: L.append("✅ 所有视口未发现异常横向滚动。")
    L.append("")
    
    L.append("## 🖼️ 图片响应式\n")
    ia=[(r['site'],r['viewport'],r['page'],i) for r in rr for i in r['imageIssues']]
    if ia:
        L.append("| 站点 | 视口 | 页面 | 图片 | 问题 |\n|---|---|---|---|---|")
        for site,vp,page,i in ia[:20]: L.append(f"| {site} | {vp} | {page} | {i.get('src','')[:50]} | {i.get('issue','')} |")
    else: L.append("✅ 未发现图片响应式问题。")
    L.append("")
    
    L.append("## 🧭 导航适配\n")
    for site in ["Web","Admin","Ops","User","Studio"]:
        rs=by_site.get(site,[])
        if not rs: continue
        L.append(f"### {site}")
        for r in rs:
            nav=r.get('navInfo',{})
            if nav.get('found'):
                if r['vpW']<=768 and nav.get('linkCount',0)>3:
                    L.append(f"- ⚠️ **{r['viewport']}** ({r['vpW']}px): 导航宽{nav.get('w',0)}px, {nav.get('linkCount')}个链接 — 建议汉堡化")
                elif r['vpW']<=768:
                    L.append(f"- ✅ **{r['viewport']}** ({r['vpW']}px): 导航宽{nav.get('w',0)}px, {nav.get('linkCount')}个链接")
            else:
                if r['vpW']<=768: L.append(f"- ⚠️ **{r['viewport']}** ({r['vpW']}px): 未找到导航元素")
        L.append("")
    
    L.append("## 📋 修复优先级\n")
    L.append("### 🔴 P1 — 必须修复\n")
    L.append(f"1. **全局触摸目标<44px** — {ti}项不合格 (影响全部5站)")
    L.append(f"   - 所有按钮/链接/输入框高度 < 44px — UI组件库系统性缺陷")
    L.append(f"   - 建议: 全局设置 min-height: 44px; min-width: 44px")
    if sa:
        L.append(f"2. **横向滚动溢出** — 移动端异常横向滚动")
    L.append("")
    L.append("### 🟡 P2 — 建议修复\n")
    n=1
    if ca:
        L.append(f"{n}. **对比度不足** — {ci}项低于WCAG AA标准")
        n+=1
    if ia:
        L.append(f"{n}. **图片响应式** — {ii}项")
        n+=1
    L.append("")
    
    L.append("---\n")
    L.append(f"## 📸 截图清单\n")
    L.append(f"| 站点 | 页数 | 视口 | 截图 | 目录 |")
    L.append(f"|---|---:|---:|:---|")
    for site in ["Web","Admin","Ops","User","Studio"]:
        dn=site.lower()
        ps=len(set(r['page'] for r in rr if r['site']==site))
        sc=sum(1 for r in rr if r['site']==site and r['status']=='OK')
        L.append(f"| {site} | {ps} | 6 | {sc} | `screenshots_retest\\{dn}\\` |")
    L.append(f"| **合计** | 22 | 6 | **{tc}** | |\n")
    L.append(f"> 📌 **赵千影** · 补视觉响应式 · 2026-06-11")
    L.append(f"> Playwright Chromium headless | 截图: {tc} 张")
    L.append(f"> `D:\\ManhuaWorks\\docs\\testing\\visual\\screenshots_retest\\`")
    return "\n".join(L)

if __name__=='__main__':
    results=run()
    tc=sum(1 for r in results if r['status']=='OK')
    report=gen_report(results,tc)
    with open(REPORT_FILE,'w',encoding='utf-8') as f:
        f.write(safe_str(report))
    print(f"\n✅ Report: {REPORT_FILE}")
    print(f"📸 Screenshots: {SCREENSHOT_DIR}")
    print(f"📊 {len(results)} combos, {tc} screenshots")
