# FirstRank vs Neo Digital: Edmonton SEO

Public-site comparison of [firstrank.ca/edmonton-seo/](https://firstrank.ca/edmonton-seo/) and [neodigital.ca/edmonton-seo/](https://neodigital.ca/edmonton-seo/). Copy the mechanisms. Do not copy Winnipeg copy or their national city grid.

## Why their Edmonton page ranks

They are a Winnipeg agency with a long-lived Edmonton service lander, not an Edmonton office. The footer on that page lists 215-309 McDermot Ave, Winnipeg, tel 204-272-7265.

The page works because it is a complete city-service template:

- Named client testimonials with call volume, revenue, and request counts
- Video proof
- Metro entities in the body (St. Albert, Leduc, Sherwood Park, Strathcona, Nisku, Beaumont)
- Transactional sections (buyers, not prospects)
- A long FAQ that answers timeline, budget, map pack, SEO vs ads, and DIY vs agency
- Sitewide structured data: `ProfessionalService`, `Organization`, `Place`, `WebPage`, plus `FAQPage` and `Service` on the Edmonton lander. Supporting Edmonton articles use `BlogPosting`.

They also run a Canada-wide city SEO grid (about 29 city landers) and a matching Google Ads city set (about 20). Edmonton is one node in that grid, with six supporting Edmonton articles:

- [10 Local SEO Tips For Edmonton](https://firstrank.ca/10-local-seo-tips-for-edmonton/)
- [Google Business Profile For Edmonton Businesses](https://firstrank.ca/gmb-for-edmonton-businesses/)
- [Citations For Businesses In Edmonton](https://firstrank.ca/citations-for-businesses-in-edmonton/)
- [Link Building In Edmonton](https://firstrank.ca/link-building-in-edmonton/)
- [Content Generation In Edmonton](https://firstrank.ca/content-generation-in-edmonton/)
- [Small Business Marketing in Edmonton](https://firstrank.ca/small-business-marketing-in-edmonton/)

Those spokes are older how-tos. Newer posts on their site target other cities (Windsor, Kelowna, Brandon, Halifax). The Edmonton lander itself still talks about the city hitting a million people by the end of 2020. Sister city pages look fresher. Homepage copy has been moving more recently than the Edmonton lander.

## What we do not copy

- Their national `{city}-seo` factory
- Their Winnipeg NAP on an Edmonton page
- 2020 population filler
- Generic testimonials that are not ours

Our win is being in Edmonton. They mention West Edmonton and Stony Plain in FAQ copy and never built those pages. They did build a Calgary hyper-local page ([Panorama Hills](https://firstrank.ca/panorama-hills-calgary/)). Depth in YEG beats another national grid.

## Steal list

1. **FAQPage JSON-LD** on `/edmonton-seo/` for the FAQs already on the page.
2. **ProfessionalService + Edmonton NAP** that matches [neodigital.ca/contact/](https://neodigital.ca/contact/): Edmonton, `587-416-4130`, `info@neodigital.ca`.
3. **Named proof with numbers.** Their quotes cite tripled calls and $150k-$200k. Ours should cite Blind Magic GSC: site clicks 4,066 to 11,382, impressions 460,723 to 1,163,424, average position 31.5 to 20.0 ([case study](https://neodigital.ca/our-work/blind-magic/)).
4. **Keep the Edmonton spoke map.** Tips, GBP, citations, links, content, and small-business articles should point at `/edmonton-seo/`. Assign those jobs to **existing** URLs. Do not add new Edmonton blog posts. Use the existing Edmonton internal-link map. Do not invent a second linker.
5. **Refresh the money page** with current metro facts. Downtown, Whyte, West Edmonton, St. Albert, Sherwood Park, Leduc, Spruce Grove, and Nisku are already named. Keep them current. Do not add a 2020-style history paragraph.
6. **Skip the national city grid.** Add Edmonton industry or neighborhood depth only when a real page has a job.

## Schema found on their public pages

| Public URL | Types that matter |
|---|---|
| `/edmonton-seo/` | ProfessionalService, Organization, Place, FAQPage, Service, VideoObject |
| `/calgary-seo/` | Same city-lander set including FAQPage |
| `/winnipeg-seo/` | ProfessionalService, Service, no FAQPage |
| Edmonton articles | BlogPosting plus the sitewide Organization set |
| Homepage | FAQPage, ProfessionalService, Organization |

Neo Digital `/edmonton-seo/` already has the FAQ accordion and Blind Magic mention. It was missing matching FAQ and local ProfessionalService markup, and the hero proof line had no numbers.

## Apply on Neo Digital

- Add FAQPage + ProfessionalService JSON-LD on page `10203`
- Replace the generic Blind Magic sentence with the GSC click and position numbers
- Keep metro names current: Downtown, Whyte, West Edmonton, Stony Plain, St. Albert, Sherwood Park, Leduc, Beaumont, Spruce Grove, Nisku
- Point Edmonton spokes at `/edmonton-seo/` through the existing internal-link map
- Do not add FirstRank city clones
