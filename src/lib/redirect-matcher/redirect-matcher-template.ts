/** Downloadable CSV template for Redirect Matcher upload. */
export const REDIRECT_MATCHER_TEMPLATE_FILENAME = "redirect-matcher-template.csv";

export function buildRedirectMatcherTemplateCsv(): string {
  return [
    "Top pages,Clicks,Impressions,CTR,Position",
    "https://example.com/2020/03/old-slug/,120,4500,2.67%,8.2",
  ].join("\n");
}
