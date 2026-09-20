# Edmonton SEO cluster (no new blogs)

Lock `/edmonton-seo/` (page 10203) as the only commercial head-term URL. Six FirstRank-style jobs use **existing** neodigital.ca URLs. Do not publish [`src/fixtures/neodigital-edmonton-aiseo-blogs.csv`](../../../src/fixtures/neodigital-edmonton-aiseo-blogs.csv).

## Assigned jobs

From `test-output/edmonton-seo-cluster-jobs.json` (17 Sep 2026).

| Job | Existing URL | ID | Notes |
|-----|--------------|----|-------|
| gbp | `/local-seo/` | 10439 | Maps and Google Business Profile page |
| citations | `/blog/local-digital-presence-that-converts/` | 7753 | Local presence post; rewrite in place for NAP |
| links | `/blog/build-digital-presence/` | 8180 | Rewrite in place for link building |
| content | `/aiseo/generative-engine-optimization/` | 10027 | GEO page already owns AI search |
| tips | `/blog/local-seo-2/` | 8741 | Local SEO Edmonton guide |
| smb | `/blog/edmonton-seo-partner/` | 8660 | Partner post; kill the hypothetical Mark draft |

No published post is titled exactly `Edmonton SEO`. Closest head-term duplicates to 301 onto the money page: `/blog/edmonton-seo-services/`, `/blog/seo-edmonton/`. Duplicate partner `/blog/seo-partner/` 301s to `/blog/edmonton-seo-partner/`.

## CSV checklist (do not publish)

| CSV slug (leave 404) | Existing URL to use |
|----------------------|---------------------|
| `ai-seo-edmonton-playbook` | `/blog/ai-seo-edmonton/` |
| `entity-based-seo-edmonton-agencies` | `/blog/entity-based-seo/` |
| `local-seo-edmonton-2026` | `/local-seo/` |
| `programmatic-seo-wordpress-edmonton` | `/aiseo/ai-content-optimization/` |
| `topical-authority-map-edmonton` | `/aiseo/` |
| `search-intent-ai-content-edmonton` | `/blog/search-intent-ai-content/` |
| `wordpress-bulk-content-seo-workflows` | `/neo-pulse-platform/` |
| `google-search-console-edmonton-wordpress` | `/blog/google-search-console-edmonton/` |
| `sitemap-internal-link-optimization-wordpress` | `/aiseo/ai-seo-audit/` |
| `eeat-ai-generated-content-edmonton-agencies` | `/blog/eeat-ai-generated-content/` |

## Scripts

- Inventory: `scripts/edmonton-internal-links/inventory.mjs`
- Classify posts: `scripts/edmonton-internal-links/classify-posts.mjs`
- Assign jobs: `scripts/edmonton-internal-links/assign-cluster-jobs.mjs`
- Link map: `scripts/edmonton-internal-links/apply-map.mjs`
