import type { PpcCampaignRow } from "@/lib/ppc/google-ads-types";

const HEADLINE_COLUMNS = Array.from({ length: 15 }, (_, i) => `Headline ${i + 1}`);
const DESCRIPTION_COLUMNS = Array.from({ length: 4 }, (_, i) => `Description ${i + 1}`);

const CSV_HEADERS = [
  "Campaign",
  "Campaign type",
  "Ad group",
  "Keyword",
  "Match type",
  "Ad type",
  ...HEADLINE_COLUMNS,
  ...DESCRIPTION_COLUMNS,
  "Final URL",
  "Path 1",
  "Path 2",
];

function csvCell(value: string): string {
  const text = value ?? "";
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function emptyRow(): string[] {
  return Array.from({ length: CSV_HEADERS.length }, () => "");
}

function rowWith(values: Partial<Record<(typeof CSV_HEADERS)[number], string>>): string[] {
  const base = emptyRow();
  for (const [key, value] of Object.entries(values)) {
    const index = CSV_HEADERS.indexOf(key);
    if (index >= 0 && value != null) {
      base[index] = value;
    }
  }
  return base;
}

export function buildGoogleAdsEditorCsv(rows: PpcCampaignRow[]): string {
  const readyRows = rows.filter((row) => row.status === "ready" && row.campaign);
  if (!readyRows.length) {
    throw new Error("No generated campaigns to export.");
  }

  const lines: string[] = [CSV_HEADERS.map(csvCell).join(",")];

  for (const row of readyRows) {
    const campaign = row.campaign!;
    const campaignName = campaign.name.trim();

    lines.push(
      rowWith({
        Campaign: campaignName,
        "Campaign type": "Search",
      })
        .map(csvCell)
        .join(","),
    );

    for (const adGroup of campaign.adGroups) {
      lines.push(
        rowWith({
          Campaign: campaignName,
          "Ad group": adGroup.name,
        })
          .map(csvCell)
          .join(","),
      );

      for (const keyword of adGroup.keywords) {
        lines.push(
          rowWith({
            Campaign: campaignName,
            "Ad group": adGroup.name,
            Keyword: keyword,
            "Match type": "Phrase",
          })
            .map(csvCell)
            .join(","),
        );
      }

      for (const ad of adGroup.ads) {
        const headlineValues = Object.fromEntries(
          ad.headlines.slice(0, 15).map((headline, index) => [`Headline ${index + 1}`, headline]),
        );
        const descriptionValues = Object.fromEntries(
          ad.descriptions.slice(0, 4).map((description, index) => [`Description ${index + 1}`, description]),
        );

        lines.push(
          rowWith({
            Campaign: campaignName,
            "Ad group": adGroup.name,
            "Ad type": "Responsive search ad",
            ...headlineValues,
            ...descriptionValues,
            "Final URL": ad.finalUrl,
            "Path 1": ad.path1 ?? "",
            "Path 2": ad.path2 ?? "",
          })
            .map(csvCell)
            .join(","),
        );
      }
    }
  }

  return `\uFEFF${lines.join("\r\n")}`;
}

export function googleAdsExportFilename(siteLabel: string): string {
  const slug = siteLabel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10);
  return `google-ads-${slug || "campaign"}-${stamp}.csv`;
}

export function triggerGoogleAdsCsvDownload(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}
