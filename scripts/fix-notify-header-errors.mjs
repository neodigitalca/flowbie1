#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const fixes = [
  ["src/hooks/overview/use-overview-tab-bulk-seo-wp.ts", 'notify.error(err instanceof Error ? err.message : "Failed to export bulk SEO CSV.", { duration: 12000 })', 'notifyHeaderError("Bulk SEO export failed", err, { duration: 12000 })'],
  ["src/hooks/overview/use-overview-tab-ai-title-meta-url-csv.ts", 'notify.error(err instanceof Error ? err.message : "Failed to export CSV.", { duration: 12000 })', 'notifyHeaderError("CSV export failed", err, { duration: 12000 })'],
  ["src/components/GMBSettingsContent.tsx", 'notify.error(err instanceof Error ? err.message : "Test and save failed")', 'notifyHeaderError("GMB test and save failed", err)'],
  ["src/components/GMBSettingsContent.tsx", 'notify.error(err instanceof Error ? err.message : "Failed to pull GMB stats")', 'notifyHeaderError("GMB stats pull failed", err)'],
  ["src/components/GMBSettingsContent.tsx", 'notify.error(err instanceof Error ? err.message : "Test failed")', 'notifyHeaderError("GMB test failed", err)'],
  ["src/components/integrations/wordpress/WordPressCardActions.tsx", 'notify.error(err instanceof Error ? err.message : "Failed to pull GMB stats")', 'notifyHeaderError("GMB stats pull failed", err)'],
  ["src/components/integrations/wordpress/WordPressCardActions.tsx", 'notify.error(err instanceof Error ? err.message : "GMB test failed")', 'notifyHeaderError("GMB test failed", err)'],
  ["src/components/integrations/wordpress/WordPressCardActions.tsx", 'notify.error(err instanceof Error ? err.message : "Google Analytics test failed")', 'notifyHeaderError("Google Analytics test failed", err)'],
  ["src/components/integrations/wordpress/BulkImportClientsDialog.tsx", 'notify.error(err instanceof Error ? err.message : "Failed to parse CSV")', 'notifyHeaderError("CSV parse failed", err)'],
  ["src/components/integrations/wordpress/BulkImportClientsDialog.tsx", 'notify.error(err instanceof Error ? err.message : "Failed to add clients")', 'notifyHeaderError("Add clients failed", err)'],
  ["src/hooks/overview/use-overview-tab-scrape-wp.ts", 'notify.error(err instanceof Error ? err.message : "Update WordPress failed.")', 'notifyHeaderError("WordPress update failed", err)'],
  ["src/components/integrations/wordpress/CompactWordPressTile.tsx", 'notify.error(err instanceof Error ? err.message : "Failed to resolve name from GBP.")', 'notifyHeaderError("GBP name resolve failed", err)'],
  ["src/components/GoogleAnalyticsSettingsContent.tsx", 'notify.error(err instanceof Error ? err.message : "Upload failed.")', 'notifyHeaderError("Upload failed", err)'],
  ["src/hooks/use-keyword-research-handlers.ts", "notify.error(errorMessage);", 'notifyHeaderError("Keyword analysis failed", err);'],
  ["src/hooks/use-wordpress-sites.ts", "notify.error(errorMessage, { duration: 6000 });", 'notifyHeaderError("WordPress site error", errorMessage, { duration: 6000 });'],
  ["src/hooks/content-optimization/optimization-helpers-b.ts", "notify.error(errorMessage, { duration: 5000 });", 'notifyHeaderError("Optimization failed", errorMessage, { duration: 5000 });'],
  ["src/hooks/use-bulk-auto-generate.ts", "notify.error(errorMessage);", 'notifyHeaderError("Bulk generate failed", errorMessage);'],
  ["src/components/integrations/entity-generation/hooks/useEntityGeneration.ts", "notify.error(errorMessage);", 'notifyHeaderError("Entity generation failed", errorMessage);'],
  ["src/components/keyword-research/KeywordInput.tsx", "notify.error(errorMessage);", 'notifyHeaderError("Keyword request failed", errorMessage);'],
  ["src/hooks/content-optimization/continue-optimization.ts", "if (!getMuteOptimizationToasts()) notify.error(errorMessage);", 'if (!getMuteOptimizationToasts()) notifyHeaderError("Optimization failed", errorMessage);'],
  ["src/components/integrations/EntityGenerationFeature.tsx", "notify.error(errorMessage);", 'notifyHeaderError("Entity generation failed", errorMessage);'],
  ["src/components/integrations/entity-generation/generation/entityGenerator.ts", "notify.error(errorMessage, { duration: 10000 });", 'notifyHeaderError("Entity generation failed", errorMessage, { duration: 10000 });'],
  ["src/components/integrations/entity-generation/generation/entityGenerator.ts", "notify.error(errorMessage);", 'notifyHeaderError("Entity generation failed", errorMessage);'],
];

for (const [file, from, to] of fixes) {
  let src = readFileSync(file, "utf8");
  if (!src.includes(from)) {
    console.error(`MISSING in ${file}: ${from.slice(0, 60)}`);
    continue;
  }
  src = src.replace(from, to);
  if (src.includes("notifyHeaderError") && !src.includes("notifyHeaderError }")) {
    src = src.replace(
      'import { notify } from "@/lib/app-notifications";',
      'import { notify, notifyHeaderError } from "@/lib/app-notifications";',
    );
  }
  writeFileSync(file, src);
  console.log(`OK ${file}`);
}
