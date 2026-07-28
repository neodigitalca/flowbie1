import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Download, Loader2, Sparkles } from "lucide-react";

const CLUSTER_CLASS =
  "inline-flex h-8 shrink-0 items-stretch overflow-hidden rounded-md border border-border bg-background";

const SEGMENT_CLASS =
  "inline-flex h-8 items-center justify-center gap-1 border-r border-border px-2 text-sm font-medium transition-colors last:border-r-0 hover:bg-muted";

type Props = {
  curating: boolean;
  onDownload: () => void;
  onCurate: () => void;
};

/** Left = download CSV only. Right = curate bulk template for selected roster clients. */
export function BenchmarkBulkSplitButton({ curating, onDownload, onCurate }: Props) {
  return (
    <div className={CLUSTER_CLASS} role="group" aria-label="Bulk CSV">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(SEGMENT_CLASS, "rounded-none")}
        title="Download bulk CSV (last curated file)"
        aria-label="Download bulk CSV"
        onClick={onDownload}
      >
        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(SEGMENT_CLASS, "rounded-none")}
        title="Curate bulk CSV from GSC for selected clients"
        aria-label="Curate bulk CSV"
        onClick={onCurate}
      >
        {curating ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
        <span className="text-sm">Curate</span>
      </Button>
    </div>
  );
}
