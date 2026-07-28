import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  downloadBulkTemplateCsvRows,
} from "@/lib/backlink-research/backlink-bulk-csv-export";
import {
  getBlogPitchOptionsForDisplay,
  type BacklinkTileEnrichment,
} from "@/lib/backlink-research/backlink-tile-enriched";
import { cn } from "@/lib/utils";

function slugFromUrl(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./i, "").split(".")[0];
    return h || "pitch";
  } catch {
    return "pitch";
  }
}

export function BacklinkBlogPitchSheet({
  enrichment,
  pageUrl,
}: {
  enrichment: BacklinkTileEnrichment;
  pageUrl: string;
}) {
  const rows = getBlogPitchOptionsForDisplay(enrichment);
  const base = slugFromUrl(pageUrl);

  if (rows.length === 0) return null;

  return (
    <div
      className={cn(
        "w-full min-w-0 overflow-hidden rounded-md border border-[hsl(var(--primary)/0.35)] bg-black/50",
        "[box-shadow:0_0_0_1px_hsl(var(--primary)/0.12)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--primary)/0.25)] bg-black/30 px-2 py-2 sm:px-3">
        <div>
          <p className="text-base font-semibold uppercase tracking-[0.1em] text-[hsl(var(--semantic-analysis-foreground))]">
            Blog ideas for bulk upload
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 border border-[hsl(var(--primary)/0.5)] bg-black/40 text-base font-semibold text-white shadow-none hover:border-[hsl(var(--primary)/0.75)] hover:bg-[hsl(var(--primary)/0.12)] hover:text-white"
          onClick={() => downloadBulkTemplateCsvRows(rows, `bulk-auto-generate-${base}`)}
        >
          <FileDown className="mr-1.5 h-3.5 w-3.5" />
          Download all CSV
        </Button>
      </div>

      <div className="max-h-[min(70vh,520px)] overflow-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-base text-white">
          <thead className="sticky top-0 z-[1] bg-zinc-950/95 backdrop-blur-sm">
            <tr className="border-b border-white/15">
              {(["keyword", "entity", "title", "modifier", "featuredImage"] as const).map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-2 py-2 font-mono text-base font-semibold uppercase tracking-wide text-[hsl(var(--semantic-data-foreground))]"
                >
                  {col}
                </th>
              ))}
              <th className="w-[7.5rem] px-2 py-2 text-base font-semibold uppercase tracking-wide text-white/70">
                CSV
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`${row.keyword}-${row.title}-${i}`}
                className="border-b border-white/10 odd:bg-white/[0.03] hover:bg-white/[0.06]"
              >
                <td className="max-w-[9rem] px-2 py-1.5 align-top font-mono text-base text-white/95" title={row.keyword}>
                  <span className="line-clamp-3">{row.keyword}</span>
                </td>
                <td className="max-w-[8rem] px-2 py-1.5 align-top text-base text-white/90" title={row.entity}>
                  <span className="line-clamp-3">{row.entity}</span>
                </td>
                <td className="min-w-[12rem] max-w-[22rem] px-2 py-1.5 align-top text-base leading-snug text-white" title={row.title}>
                  {row.title}
                </td>
                <td className="max-w-[14rem] px-2 py-1.5 align-top text-base text-white/85" title={row.modifier}>
                  <span className="line-clamp-4">{row.modifier || " - "}</span>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 align-top font-mono text-base text-[hsl(var(--semantic-data-foreground))]">
                  {row.featuredImage}
                </td>
                <td className="whitespace-nowrap px-1 py-1 align-top">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 min-h-9 border border-[hsl(var(--semantic-data)/0.35)] px-2 text-base font-semibold text-white hover:bg-[hsl(var(--semantic-data)/0.12)]"
                    onClick={() =>
                      downloadBulkTemplateCsvRows([row], `${base}-row-${i + 1}`)
                    }
                  >
                    <FileDown className="mr-1 h-3 w-3" />
                    Download
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
