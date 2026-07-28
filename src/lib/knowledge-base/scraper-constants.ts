export const SCRAPER_STEPS = [
  { key: "init", label: "Initializing", shortLabel: "Init", progress: 5 },
  { key: "discover", label: "Discovering Pages", shortLabel: "Discover", progress: 10 },
  { key: "scrape", label: "Scraping Content", shortLabel: "Scrape", progress: 40 },
  { key: "convert", label: "Converting to Markdown", shortLabel: "Convert", progress: 70 },
  { key: "store", label: "Storing to KB", shortLabel: "Store", progress: 90 },
  { key: "complete", label: "Complete", shortLabel: "Done", progress: 100 },
] as const;

export type ScraperStepKey = (typeof SCRAPER_STEPS)[number]["key"];

export const SCRAPER_STEP_LABELS: Record<string, string> = SCRAPER_STEPS.reduce(
  (acc, step) => {
    acc[step.key] = step.label;
    return acc;
  },
  {} as Record<string, string>,
);

export function getScraperStepIndex(stepKey: string | null): number {
  if (!stepKey) return 0;
  const idx = SCRAPER_STEPS.findIndex((s) => s.key === stepKey);
  return idx === -1 ? 0 : idx;
}
