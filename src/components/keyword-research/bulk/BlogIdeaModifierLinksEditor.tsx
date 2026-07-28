import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BlogIdeaModifierLinksEditorProps = {
  links: string[];
  disabled?: boolean;
  onChange: (links: string[]) => void;
  idPrefix: string;
};

export function BlogIdeaModifierLinksEditor({
  links,
  disabled,
  onChange,
  idPrefix,
}: BlogIdeaModifierLinksEditorProps) {
  const rows = links.length > 0 ? links : [""];

  const updateAt = (index: number, value: string) => {
    const next = [...rows];
    next[index] = value;
    onChange(next);
  };

  const removeAt = (index: number) => {
    if (rows.length <= 1) {
      onChange([""]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onChange([...rows, ""]);
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2" onClick={(e) => e.stopPropagation()}>
      <span className="text-base text-muted-foreground">Links</span>
      <div className="flex flex-col gap-1.5">
        {rows.map((link, index) => (
          <div key={`${idPrefix}-link-${index}`} className="flex min-w-0 items-center gap-2">
            <Input
              id={`${idPrefix}-link-${index}`}
              type="url"
              value={link}
              disabled={disabled}
              placeholder="https://"
              className={cn("min-h-9 min-w-0 flex-1 text-base")}
              aria-label={`External link ${index + 1}`}
              onChange={(e) => updateAt(index, e.target.value)}
            />
            {rows.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-zinc-400 hover:text-zinc-100"
                disabled={disabled}
                aria-label={`Remove link ${index + 1}`}
                onClick={() => removeAt(index)}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-fit gap-1.5 px-2 text-base text-zinc-300 hover:text-white"
          disabled={disabled}
          aria-label="Add link"
          onClick={addRow}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add link
        </Button>
      </div>
    </div>
  );
}
