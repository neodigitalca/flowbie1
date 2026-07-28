import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/app-notifications";
import { copyTextToClipboard } from "@/lib/backlink-research/backlink-bulk-csv-export";
import {
  getFormSubmissionForDisplay,
  type BacklinkFormSubmission,
  type BacklinkTileEnrichment,
  type FormSubmissionDisplayOptions,
} from "@/lib/backlink-research/backlink-tile-enriched";
import { cn } from "@/lib/utils";

function buildCopyAllText(s: BacklinkFormSubmission): string {
  const parts: string[] = [];
  parts.push(s.subjectLine);
  parts.push("");
  parts.push(s.proposalMessage);
  if (s.keywordTitleIdeasPlainList.trim()) {
    parts.push("");
    parts.push(s.keywordTitleIdeasPlainList);
  }
  if (s.extraFields?.length) {
    parts.push("");
    for (const e of s.extraFields) {
      parts.push(`${e.label}: ${e.value}`);
    }
  }
  return parts.join("\n");
}

function CopyRow({
  label,
  text,
  multiline,
}: {
  label: string;
  text: string;
  multiline?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-base font-semibold uppercase tracking-[0.08em] text-white/75">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 min-h-9 shrink-0 border border-white/20 px-2 text-base font-semibold text-white hover:bg-white/10"
          onClick={async () => {
            const ok = await copyTextToClipboard(text);
            notify[ok ? "success" : "error"](ok ? "Copied" : "Could not copy");
          }}
        >
          <Copy className="mr-1 h-3 w-3" />
          Copy
        </Button>
      </div>
      {multiline ? (
        <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded border border-white/15 bg-black/40 p-2 text-base leading-snug text-white">
          {text}
        </pre>
      ) : (
        <div className="rounded border border-white/15 bg-black/40 px-2 py-1.5 text-base leading-snug text-white">
          {text}
        </div>
      )}
    </div>
  );
}

export function BacklinkFormSubmissionCard({
  enrichment,
  connectedSiteName,
}: {
  enrichment: BacklinkTileEnrichment;
  connectedSiteName?: FormSubmissionDisplayOptions["connectedSiteName"];
}) {
  const s = getFormSubmissionForDisplay(enrichment, { connectedSiteName });

  return (
    <div
      className={cn(
        "w-full min-w-0 rounded-md border border-[hsl(var(--semantic-analysis)/0.35)] bg-[hsl(var(--semantic-analysis)/0.06)]",
        "px-2 py-2 sm:px-3 sm:py-2.5",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-base font-semibold uppercase tracking-[0.1em] text-[hsl(var(--semantic-analysis-foreground))]">
            Form submission copy
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 border border-[hsl(var(--semantic-analysis)/0.45)] bg-black/35 text-base font-semibold text-white shadow-none hover:border-[hsl(var(--semantic-analysis)/0.65)] hover:bg-[hsl(var(--semantic-analysis)/0.12)] hover:text-white"
          onClick={async () => {
            const ok = await copyTextToClipboard(buildCopyAllText(s));
            notify[ok ? "success" : "error"](ok ? "Copied all" : "Could not copy");
          }}
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Copy all
        </Button>
      </div>

      <div className="space-y-3">
        <CopyRow label="Subject" text={s.subjectLine} />

        <CopyRow label="Your message" text={s.proposalMessage} multiline />

        {s.extraFields?.length ? (
          <div className="space-y-2">
            <p className="text-base font-semibold uppercase tracking-[0.08em] text-white/75">
              Other fields
            </p>
            {s.extraFields.map((f, i) => (
              <CopyRow key={`${f.label}-${i}`} label={f.label} text={f.value} multiline={f.value.length > 80} />
            ))}
          </div>
        ) : null}

        {s.keywordTitleIdeasPlainList.trim() ? (
          <CopyRow label="Article ideas (plain list)" text={s.keywordTitleIdeasPlainList} multiline />
        ) : null}
      </div>
    </div>
  );
}
