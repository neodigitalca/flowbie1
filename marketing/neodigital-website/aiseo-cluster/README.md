# Neo Digital website: AISEO cluster + NEO Pulse landing

Paste-ready page copy for [neodigital.ca](https://neodigital.ca/). Publish as **WordPress Pages**, not blog posts.

**Contact CTA:** [https://neodigital.ca/contact/](https://neodigital.ca/contact/) (service dropdown already includes SEO / AI SEO)  
**Product CTA:** [https://neodigital.ca/neo-pulse/](https://neodigital.ca/neo-pulse/)

## Information architecture

```
/aiseo/                                              pillar (this file: 00)
  /aiseo/what-is-aiseo/                              sub 1
  /aiseo/ai-content-optimization/                    sub 2
  /aiseo/generative-engine-optimization/             sub 3
  /aiseo/ai-seo-audit/                               sub 4
/neo-pulse/                                          product landing (existing URL)
```

Set parent of the four subpages to **AISEO**. Keep NEO Pulse at the root (already live).

## Keyword targets (Google Ads volume, US, Aug 2026)

| Page | Focus keyword | Related | Approx. volume |
|------|---------------|---------|----------------|
| Pillar | AI SEO | AISEO, AI SEO services, AI SEO agency | 8,100 / 1,000 / 1,300 / 1,300 |
| What is AISEO | what is AI SEO | AISEO | 390 / 1,000 |
| AI content optimization | AI SEO WordPress | AI content SEO | 40 / 20 (service page, not volume-led) |
| Generative engine optimization | generative engine optimization | GEO SEO, answer engine optimization, AI search optimization | 4,400 / 2,900 / 2,400 / 1,300 |
| AI SEO audit | AI SEO audit | | 110 |
| NEO Pulse | NEO Pulse | AI content and flow manager WordPress | branded |

## Internal links (required)

Every page already includes these anchors in the body. After publish, verify they resolve.

- Pillar → all four subpages + `/neo-pulse/` + `/contact/`
- Each subpage → pillar + two sibling pages + `/neo-pulse/` + `/contact/`
- NEO Pulse → `/aiseo/` + `/contact/`

## Rank Math / schema

| Page | Schema | Notes |
|------|--------|--------|
| Pillar | Service + FAQ | Service name: AISEO |
| Subpages | FAQPage + WebPage | Keep FAQ answers as written |
| NEO Pulse | SoftwareApplication + FAQ | Application category: BusinessApplication |

## Front matter

Each markdown file starts with YAML for the editor. Do not paste the YAML onto the live page. Paste **H1 through last FAQ** into the WordPress body (or map fields in Elementor).

## Files

| File | WP title | Slug |
|------|----------|------|
| `00-aiseo-pillar.md` | AISEO \| AI SEO Services | `aiseo` |
| `01-what-is-aiseo.md` | What Is AISEO? | `what-is-aiseo` |
| `02-ai-content-optimization.md` | AI Content Optimization | `ai-content-optimization` |
| `03-generative-engine-optimization.md` | Generative Engine Optimization | `generative-engine-optimization` |
| `04-ai-seo-audit.md` | AI SEO Audit | `ai-seo-audit` |
| `05-neo-pulse-landing.md` | NEO Pulse | `neo-pulse` (replace Loading state) |
