import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/app-notifications";
import { copyTextToClipboard } from "@/lib/backlink-research/backlink-bulk-csv-export";
import {
  formatSubmissionHowToForCopy,
  type BacklinkSubmissionHowTo,
  type BacklinkTileEnrichment,
} from "@/lib/backlink-research/backlink-tile-enriched";
import { cn } from "@/lib/utils";

function hasContent(h: BacklinkSubmissionHowTo | undefined): h is BacklinkSubmissionHowTo {
  if (!h) return false;
  return (h.submissionEmails?.length ?? 0) > 0 || (h.items?.length ?? 0) > 0;
}

export function BacklinkSubmissionHowToCard({ enrichment }: { enrichment: BacklinkTileEnrichment }) {
  const h = enrichment.submissionHowTo;
  if (!hasContent(h)) return null;

  const allText = formatSubmissionHowToForCopy(h);

  return (
    <div
      className={cn(
        "w-full min-w-0 rounded-md border border-[hsl(var(--semantic-analysis)/0.35)] bg-[hsl(var(--semantic-analysis)/0.06)]",
        "px-2 py-2 sm:px-3 sm:py-2.5",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold uppercase tracking-[0.1em] text-[hsl(var(--semantic-analysis-foreground))]">
          How to submit
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 border border-[hsl(var(--semantic-analysis)/0.45)] bg-black/35 text-base font-semibold text-white shadow-none hover:border-[hsl(var(--semantic-analysis)/0.65)] hover:bg-[hsl(var(--semantic-analysis)/0.12)] hover:text-white"
          onClick={async () => {
            const ok = await copyTextToClipboard(allText);
            notify[ok ? "success" : "error"](ok ? "Copied" : "Could not copy");
          }}
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Copy all
        </Button>
      </div>

      <div className="space-y-3">
        {h.submissionEmails?.length ? (
          <div className="min-w-0 space-y-1.5">
            <p className="text-base font-semibold uppercase tracking-[0.08em] text-white/75">
              Send to
            </p>
            <ul className="space-y-1.5">
              {h.submissionEmails.map((email) => (
                <li key={email} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-all text-base leading-snug text-white">{email}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 min-h-9 shrink-0 border border-white/20 px-2 text-base font-semibold text-white hover:bg-white/10"
                    onClick={async () => {
                      const ok = await copyTextToClipboard(email);
                      notify[ok ? "success" : "error"](ok ? "Copied" : "Could not copy");
                    }}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {h.items?.length ? (
          <div
            className={cn(
              "space-y-2.5",
              h.submissionEmails?.length ? "border-t border-white/10 pt-3" : null,
            )}
          >
            {h.items.map((row, i) => (
              <div
                key={`${row.label}-${i}`}
                className="rounded border border-white/12 bg-black/35 px-2.5 py-2 text-base leading-relaxed text-white/95"
              >
                <p className="font-semibold text-white">{row.label}</p>
                <p className="mt-1 text-white/90">{row.detail}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
