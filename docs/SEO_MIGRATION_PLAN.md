# SEO Migration Plan: 6-App to 3-App Consolidation

> Migration window: TBD | Expected SEO recovery: 3-6 months

---

## 1. 301 Redirect Mapping Table

All old URLs must return HTTP 301 (permanent redirect) to pass link equity to the new URLs.

### web:3000 -> main:3000

| Old URL | New URL | Notes |
|---------|---------|-------|
| `(web:3000)/` | `(main:3000)/` | No change |
| `(web:3000)/showcase` | `(main:3000)/showcase` | No change |
| `(web:3000)/pricing` | `(main:3000)/pricing` | No change |
| `(web:3000)/login` | `(main:3000)/login` | No change |
| `(web:3000)/studio` | `(main:3000)/dashboard` | **Redirect** |
| `(web:3000)/studio/project/:id` | `(main:3000)/create/animation/:id` | **Redirect** |
| `(web:3000)/studio/storyboard` | `(main:3000)/create/animation` | **Redirect** |
| `(web:3000)/projects` | `(main:3000)/projects` | No change |
| `(web:3000)/assets` | `(main:3000)/materials` | **Redirect** |
| `(web:3000)/materials` | `(main:3000)/materials` | No change |
| `(web:3000)/settings` | `(main:3000)/settings` | No change |

### studio:5175 -> main:3000

| Old URL | New URL | Notes |
|---------|---------|-------|
| `(studio:5175)/` | `(main:3000)/dashboard` | **Redirect** |
| `(studio:5175)/characters` | `(main:3000)/create/animation` | **Redirect** |
| `(studio:5175)/scenes` | `(main:3000)/create/animation` | **Redirect** |
| `(studio:5175)/workflow` | `(main:3000)/create/animation` | **Redirect** |
| `(studio:5175)/project` | `(main:3000)/create/animation` | **Redirect** |
| `(studio:5175)/tools` | `(main:3000)/tools` | **Redirect** |
| `(studio:5175)/export` | `(main:3000)/create/animation` | **Redirect** |

### user-portal:5180 -> customer:5180

| Old URL | New URL | Notes |
|---------|---------|-------|
| `(user-portal:5180)/dashboard` | `(customer:5180)/dashboard` | No change |
| `(user-portal:5180)/projects` | `(customer:5180)/projects` | No change |
| `(user-portal:5180)/works` | `(customer:5180)/works` | No change |
| `(user-portal:5180)/assets` | `(customer:5180)/assets` | No change |
| `(user-portal:5180)/settings` | `(customer:5180)/settings` | No change |
| `(user-portal:5180)/byok` | `(customer:5180)/settings/api-keys` | **Redirect** |
| `(user-portal:5180)/notifications` | `(customer:5180)/notifications` | No change |

### dev-portal:5178 -> customer:5180

| Old URL | New URL | Notes |
|---------|---------|-------|
| `(dev-portal:5178)/` | `(customer:5180)/dev` | **Redirect** |
| `(dev-portal:5178)/docs` | `(customer:5180)/dev/docs` | **Redirect** |
| `(dev-portal:5178)/api-keys` | `(customer:5180)/dev/keys` | **Redirect** |
| `(dev-portal:5178)/playground` | `(customer:5180)/dev/playground` | **Redirect** |
| `(dev-portal:5178)/sdk` | `(customer:5180)/dev/sdk` | **Redirect** |

### admin-portal:5174 -> admin:5174

| Old URL | New URL | Notes |
|---------|---------|-------|
| `(admin-portal:5174)/dashboard` | `(admin:5174)/dashboard` | No change |
| `(admin-portal:5174)/users` | `(admin:5174)/users` | No change |

### ops-portal:5176 -> admin:5174

| Old URL | New URL | Notes |
|---------|---------|-------|
| `(ops-portal:5176)/dashboard` | `(admin:5174)/monitoring` | **Redirect** |
| `(ops-portal:5176)/monitoring` | `(admin:5174)/monitoring` | **Redirect** |
| `(ops-portal:5176)/system` | `(admin:5174)/system` | **Redirect** |
| `(ops-portal:5176)/logs` | `(admin:5174)/ops-logs` | **Redirect** |

---

## 2. Sitemap Generation

### Pre-launch

1. Export the current sitemap from each of the 6 legacy apps.
2. Generate a new unified `sitemap.xml` for each of the 3 target apps:
   - `main:3000/sitemap.xml` -- public pages, dashboard, create, tools, projects, materials, settings
   - `customer:5180/sitemap.xml` -- dashboard, projects, works, assets, settings, notifications, dev/*
   - `admin:5174/sitemap.xml` -- dashboard, users, monitoring, system, ops-logs (if indexed)
3. Set `<lastmod>` dates to the migration date for all URLs so crawlers re-index promptly.
4. Include `<xhtml:link rel="alternate" hreflang="...">` tags if multi-locale is active.

### Sitemap index

Create a top-level `sitemap-index.xml` at the primary domain that references each app's sitemap:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://manhua.app/sitemap.xml</loc>
    <lastmod>2025-XX-XX</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://my.manhua.app/sitemap.xml</loc>
    <lastmod>2025-XX-XX</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://admin.manhua.app/sitemap.xml</loc>
    <lastmod>2025-XX-XX</lastmod>
  </sitemap>
</sitemapindex>
```

### Post-launch

- Keep old sitemaps accessible at legacy domains for at least 90 days so Google can discover the redirects.
- Submit new sitemaps to Google Search Console and Bing Webmaster Tools on launch day.
- Remove old sitemaps from Search Console after 90 days once traffic has fully migrated.

---

## 3. Nginx Redirect Configuration

```nginx
# ============================================================
# 301 Redirects: 6-app -> 3-app consolidation
# Place in /etc/nginx/conf.d/redirects.conf or include from
# the main server block. Order matters -- specific paths first.
# ============================================================

# --- web:3000 -> main:3000 ---
server {
    listen 80;
    server_name web.manhua.app;

    # Studio routes -> create/animation
    rewrite ^/studio/project/(.+)$ https://main.manhua.app/create/animation/$1 permanent;
    rewrite ^/studio/storyboard$    https://main.manhua.app/create/animation  permanent;
    rewrite ^/studio$               https://main.manhua.app/dashboard     permanent;

    # Assets -> materials
    rewrite ^/assets$               https://main.manhua.app/materials     permanent;

    # Direct mappings (no path change)
    location / {
        return 301 https://main.manhua.app$request_uri;
    }
}

# --- studio:5175 -> main:3000 ---
server {
    listen 80;
    server_name studio.manhua.app;

    rewrite ^/characters$ https://main.manhua.app/create/animation permanent;
    rewrite ^/scenes$     https://main.manhua.app/create/animation permanent;
    rewrite ^/workflow$   https://main.manhua.app/create/animation permanent;
    rewrite ^/project$    https://main.manhua.app/create/animation permanent;
    rewrite ^/export$     https://main.manhua.app/create/animation permanent;
    rewrite ^/tools$      https://main.manhua.app/tools        permanent;

    location / {
        return 301 https://main.manhua.app/dashboard;
    }
}

# --- user-portal:5180 -> customer:5180 ---
server {
    listen 80;
    server_name user-portal.manhua.app;

    rewrite ^/byok$ https://customer.manhua.app/settings/api-keys permanent;

    location / {
        return 301 https://customer.manhua.app$request_uri;
    }
}

# --- dev-portal:5178 -> customer:5180/dev ---
server {
    listen 80;
    server_name dev-portal.manhua.app;

    rewrite ^/docs$       https://customer.manhua.app/dev/docs       permanent;
    rewrite ^/api-keys$   https://customer.manhua.app/dev/keys       permanent;
    rewrite ^/playground$ https://customer.manhua.app/dev/playground permanent;
    rewrite ^/sdk$        https://customer.manhua.app/dev/sdk        permanent;

    location / {
        return 301 https://customer.manhua.app/dev;
    }
}

# --- admin-portal:5174 -> admin:5174 (direct) ---
server {
    listen 80;
    server_name admin-portal.manhua.app;

    location / {
        return 301 https://admin.manhua.app$request_uri;
    }
}

# --- ops-portal:5176 -> admin:5174 ---
server {
    listen 80;
    server_name ops-portal.manhua.app;

    rewrite ^/dashboard$  https://admin.manhua.app/monitoring permanent;
    rewrite ^/monitoring$ https://admin.manhua.app/monitoring permanent;
    rewrite ^/system$     https://admin.manhua.app/system     permanent;
    rewrite ^/logs$       https://admin.manhua.app/ops-logs   permanent;

    location / {
        return 301 https://admin.manhua.app/monitoring;
    }
}
```

### SPA fallback (inside each new app's server block)

```nginx
# Ensure 301s are processed before the SPA catch-all
location / {
    try_files $uri $uri/ /index.html;
}
```

### Verification

After deployment, verify every redirect with:

```bash
# Spot-check a few critical paths
curl -sI https://web.manhua.app/studio | grep -E 'HTTP|Location'
curl -sI https://studio.manhua.app/characters | grep -E 'HTTP|Location'
curl -sI https://dev-portal.manhua.app/api-keys | grep -E 'HTTP|Location'
curl -sI https://ops-portal.manhua.app/logs | grep -E 'HTTP|Location'
```

All should return `HTTP/1.1 301 Moved Permanently` with the correct `Location` header.

---

## 4. Google Search Console Update Checklist

Complete these steps on or immediately after launch day.

- [ ] **Add & verify** the 3 new domain properties in Google Search Console (if using separate subdomains):
  - `main.manhua.app`
  - `customer.manhua.app`
  - `admin.manhua.app`
- [ ] **Submit new sitemaps** for each new property.
- [ ] **Use the Change of Address tool** for each legacy domain that is being retired:
  - `web.manhua.app` -> `main.manhua.app`
  - `studio.manhua.app` -> `main.manhua.app`
  - `user-portal.manhua.app` -> `customer.manhua.app`
  - `dev-portal.manhua.app` -> `customer.manhua.app`
  - `admin-portal.manhua.app` -> `admin.manhua.app`
  - `ops-portal.manhua.app` -> `admin.manhua.app`
- [ ] **Remove old sitemaps** from legacy properties (after 90 days).
- [ ] **Monitor Coverage report** daily for the first 2 weeks -- fix any 404s or redirect chains.
- [ ] **Check "Page Experience"** and "Core Web Vitals" reports for regressions.
- [ ] **Update canonical tags** on every page to point to the new URL.
- [ ] **Update structured data** (`@id`, `url` fields) in JSON-LD to new URLs.
- [ ] **Update internal links** across all 3 apps so they point to new URLs (no redirect hops).
- [ ] **Update robots.txt** on legacy domains to keep allowing crawlers (so 301s are followed).
- [ ] **Repeat for Bing Webmaster Tools** -- submit sitemaps, use Site Move.
- [ ] **Update Baidu Webmaster** if Chinese search engine indexing is relevant.

---

## 5. SEO Recovery Timeline

| Phase | Timeframe | What to Expect |
|-------|-----------|----------------|
| **Week 0 (Launch)** | Day 0-7 | Traffic dip as crawlers discover redirects. Monitor 301s and server logs closely. |
| **Week 1-2** | Day 7-14 | Google begins re-crawling redirected URLs. Coverage report shows "Redirected" status. |
| **Week 3-4** | Day 14-30 | New URLs start appearing in search index. Old URLs begin dropping. Rankings may fluctuate. |
| **Month 2** | Day 30-60 | Majority of link equity transferred. Rankings stabilize for most pages. |
| **Month 3-4** | Day 60-120 | Organic traffic should approach pre-migration levels. Fix any remaining crawl errors. |
| **Month 5-6** | Day 120-180 | Full recovery expected. Traffic and rankings at or above pre-migration baseline. |

### Risk Factors That Can Extend Recovery

- Redirect chains (A -> B -> C) instead of direct 301s -- avoid at all costs.
- Missing or incorrect canonical tags on new pages.
- Pages that return 404 instead of 301 -- audit thoroughly.
- Significant content changes on redirected pages (Google may treat as new page).
- Slow server response times during migration window.

### Success Metrics

Track these KPIs weekly and compare to pre-migration baseline:

1. **Organic sessions** (Google Analytics) -- primary recovery indicator.
2. **Indexed pages** (Search Console Coverage) -- should converge to new URL count.
3. **Keyword rankings** (SEMrush / Ahrefs) -- top-10 positions for branded and non-branded terms.
4. **Backlink retention** -- verify high-value backlinks still resolve via 301s.
5. **Crawl budget** -- Search Console "Crawl Stats" should normalize within 4 weeks.

---

## 6. Rollback Plan

If critical issues arise within the first 48 hours:

1. Re-enable legacy app containers / server blocks.
2. Remove 301 redirects from Nginx.
3. Re-point DNS to old infrastructure (if changed).
4. Re-submit old sitemaps to Search Console.
5. Post-mortem and fix before re-attempting migration.

---

*Last updated: 2025-XX-XX*
