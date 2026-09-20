export function downloadAdsReportingArtifacts(args: {
  markdown: string;
  files: { name: string; content: string }[];
  siteName: string;
  comparePreset: "mom" | "yoy";
  dateStamp?: number;
}): void {
  const stamp = args.dateStamp ?? Date.now();
  const slug = args.siteName.replace(/\s+/g, "-").replace(/[^\w-]/g, "").toLowerCase() || "ppc-report";
  const presetTag = args.comparePreset === "yoy" ? "yoy" : "mom";
  const trigger = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  trigger(args.markdown.trim(), `ppc-report-${presetTag}-${slug}-${stamp}.md`, "text/markdown;charset=utf-8");
  for (const file of args.files) {
    if (!file.name.endsWith(".csv")) continue;
    trigger(file.content, `${presetTag}-${file.name.replace(/[/\\?%*:|"<>]/g, "-")}`, "text/csv;charset=utf-8");
  }
}
