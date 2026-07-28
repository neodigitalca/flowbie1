import { useRef } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BULK_HEADER_ICON_TOOL_BTN,
  BULK_HEADER_TOOL_BTN,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { semrushIssueLabelFromFilename } from "@/lib/overview/parse-semrush-error-csv";

export type OverviewSemrushCsvUploadProps = {
  fileName: string | null;
  urlCount: number;
  disabled?: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
};

export function OverviewSemrushCsvUpload({
  fileName,
  urlCount,
  disabled,
  onUpload,
  onClear,
}: OverviewSemrushCsvUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
      <div
        className="flex min-w-0 shrink-0 flex-nowrap items-center gap-1.5"
        role="group"
        aria-label="SEMrush CSV"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={BULK_HEADER_TOOL_BTN}
          disabled={disabled}
          aria-label="Upload SEMrush CSV"
          title="Upload SEMrush CSV"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4 shrink-0" aria-hidden />
          SEMrush
        </Button>
        {fileName ? (
          <span className="max-w-[14rem] truncate text-base text-muted-foreground" title={fileName}>
            {fileName} ({urlCount} · {semrushIssueLabelFromFilename(fileName)})
          </span>
        ) : null}
        {fileName ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={BULK_HEADER_ICON_TOOL_BTN}
            disabled={disabled}
            aria-label="Clear SEMrush CSV filter"
            title="Clear SEMrush CSV filter"
            onClick={onClear}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        ) : null}
      </div>
    </>
  );
}
