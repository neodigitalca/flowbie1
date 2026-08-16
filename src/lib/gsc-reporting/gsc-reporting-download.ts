export type GscReportingArtifactFile = { name: string; content: string };

const KEY_CSV_PREFIXES = ["Queries-", "Pages-", "Site-totals-"];

function triggerBlobDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugifySiteName(siteName: string): string {
  return siteName.replace(/\s+/g, "-").replace(/[^\w-]/g, "").toLowerCase() || "gsc-report";
}

function isKeyCsv(name: string): boolean {
  const base = name.split("/").pop() ?? name;
  return KEY_CSV_PREFIXES.some((prefix) => base.startsWith(prefix)) && base.endsWith(".csv");
}

export type DownloadGscReportingArtifactsArgs = {
  markdown: string;
  files: GscReportingArtifactFile[];
  siteName: string;
  comparePreset: "mom" | "yoy";
  dateStamp?: number;
};

/** Browser download of stitched report markdown and key MoM/YoY CSV bundle. */
export function downloadGscReportingArtifacts(args: DownloadGscReportingArtifactsArgs): void {
  const stamp = args.dateStamp ?? Date.now();
  const slug = slugifySiteName(args.siteName);
  const presetTag = args.comparePreset === "yoy" ? "yoy" : "mom";

  triggerBlobDownload(
    args.markdown.trim(),
    `gsc-report-${presetTag}-${slug}-${stamp}.md`,
    "text/markdown;charset=utf-8",
  );

  for (const file of args.files) {
    if (!isKeyCsv(file.name)) continue;
    const safeName = file.name.replace(/[/\\?%*:|"<>]/g, "-");
    triggerBlobDownload(file.content, `${presetTag}-${safeName}`, "text/csv;charset=utf-8");
  }
}
