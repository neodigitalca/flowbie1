import type { ImageReferenceProvenance } from "@/components/generator/image/image-generator-types";
import {
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";

type ImageDetailsDrawerProps = {
  isGenerating: boolean;
  isGeneratingChecklist: boolean;
  error: string | null;
  imageSourceMode: string;
  referenceResearch: ImageReferenceProvenance | null;
};

export function ImageDetailsDrawer({
  isGenerating,
  isGeneratingChecklist,
  error,
  imageSourceMode,
  referenceResearch,
}: ImageDetailsDrawerProps) {
  const status = isGeneratingChecklist
    ? "Building checklist…"
    : isGenerating
      ? "Gathering references and generating image…"
      : error
        ? error
        : referenceResearch
          ? "Ready"
          : "Run Image to gather Google Images sources.";

  let stripe = 0;

  return (
    <div className={CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS}>
      <div className={contentOptimizerRowStripeClass(stripe++)}>
        <div className="space-y-1 px-2.5 py-1.5 text-base sm:px-3">
          <p className="font-semibold text-white">Status</p>
          <p className="text-muted-foreground">{status}</p>
          <p className="text-muted-foreground">Mode: {imageSourceMode}</p>
        </div>
      </div>

      {referenceResearch ? (
        <div className={contentOptimizerRowStripeClass(stripe++)}>
          <div className="space-y-3 px-2.5 py-2 text-base sm:px-3">
            <p className="font-semibold text-white">Google Images references</p>
            <p className="text-muted-foreground">
              Grounding: {referenceResearch.mode}
              {referenceResearch.queries.length
                ? ` · Queries: ${referenceResearch.queries.join(", ")}`
                : ""}
            </p>
            {referenceResearch.references.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {referenceResearch.references.map((ref) => (
                  <div key={`${ref.query}-${ref.imageUrl}`} className="space-y-2 bg-black p-3">
                    {ref.previewDataUrl || ref.imageUrl ? (
                      <img
                        src={ref.previewDataUrl || ref.imageUrl}
                        alt={`Reference for ${ref.query}`}
                        className="max-h-36 w-full object-contain"
                      />
                    ) : null}
                    <p className="text-white">
                      {ref.layer ? `${ref.layer} · ` : ""}
                      {ref.kind}: {ref.query}
                    </p>
                    {ref.why ? <p className="text-muted-foreground">{ref.why}</p> : null}
                    {ref.sourceUrl ? (
                      <a
                        href={ref.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lime-400 underline hover:text-lime-300"
                      >
                        Source
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
