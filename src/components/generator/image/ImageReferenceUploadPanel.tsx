import { useRef } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ManualImageReference } from "@/lib/image-generator/manual-reference-upload";

type ImageReferenceUploadPanelProps = {
  manualReferences: ManualImageReference[];
  isPreparingReferences: boolean;
  disabled: boolean;
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveReference: (id: string) => void;
};

export function ImageReferenceUploadPanel({
  manualReferences,
  isPreparingReferences,
  disabled,
  onAddFiles,
  onRemoveReference,
}: ImageReferenceUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const controlsDisabled = disabled || isPreparingReferences;

  return (
    <div className="space-y-3 bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-base font-semibold text-foreground">Reference photos</Label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="text-base"
          disabled={controlsDisabled}
          onClick={() => inputRef.current?.click()}
        >
          {isPreparingReferences ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Preparing…
            </>
          ) : (
            <>
              <ImagePlus className="mr-2 h-4 w-4" />
              Upload images
            </>
          )}
        </Button>
      </div>

      <p className="text-base text-muted-foreground">
        Optional. When you upload references, Google Images research is skipped and these photos
        are sent to the model instead.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={controlsDisabled}
        onChange={(event) => {
          const files = event.target.files;
          if (files?.length) onAddFiles(files);
          event.target.value = "";
        }}
      />

      {manualReferences.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {manualReferences.map((ref) => (
            <div key={ref.id} className="relative space-y-2 bg-black p-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-8 w-8 text-muted-foreground hover:text-foreground"
                disabled={controlsDisabled}
                aria-label={`Remove ${ref.fileName}`}
                onClick={() => onRemoveReference(ref.id)}
              >
                <X className="h-4 w-4" />
              </Button>
              <img
                src={ref.dataUrl}
                alt={`Reference ${ref.fileName}`}
                className="max-h-40 w-full object-contain"
              />
              <p className="truncate text-base text-foreground">{ref.fileName}</p>
              <p className="text-base text-muted-foreground">Manual upload</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
