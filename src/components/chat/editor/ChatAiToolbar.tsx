import React, { useCallback, useRef, useState } from "react";
import { ChevronDown, Loader2, Sparkles, SpellCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { transformChatHtml, type ChatAiMode } from "@/lib/chat-ai-compose";
import type { ChatRichEditorHandle } from "@/components/chat/editor/ChatRichEditor";

export type ChatAiToolbarProps = {
  editorRef: React.RefObject<ChatRichEditorHandle | null>;
  disabled?: boolean;
  onHtmlChange?: (html: string) => void;
  inline?: boolean;
};

export function ChatAiToolbar({
  editorRef,
  disabled,
  onHtmlChange,
  inline = false,
}: ChatAiToolbarProps): React.ReactElement {
  const [activeMode, setActiveMode] = useState<ChatAiMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runTransform = useCallback(
    async (mode: ChatAiMode) => {
      const editor = editorRef.current;
      if (!editor || disabled) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setActiveMode(mode);
      setError(null);

      const html = editor.getHtml();
      const result = await transformChatHtml(html, mode, controller.signal);

      if (controller.signal.aborted) return;

      setActiveMode(null);
      if (result.ok) {
        editor.setHtml(result.bodyHtml);
        onHtmlChange?.(result.bodyHtml);
      } else if (result.error !== "Cancelled") {
        setError(result.error);
      }
    },
    [disabled, editorRef, onHtmlChange],
  );

  const busy = activeMode != null;
  const btnClass = "h-8 gap-1.5 px-2 text-base text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900";

  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", !inline && "border-b border-zinc-200 px-2 py-1")}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled || busy}
        className={btnClass}
        onClick={() => void runTransform("correct")}
      >
        {activeMode === "correct" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <SpellCheck className="h-4 w-4" />
        )}
        Correct
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled || busy}
        className={btnClass}
        onClick={() => void runTransform("enhance")}
      >
        {activeMode === "enhance" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Enhance
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" disabled={disabled || busy} className={btnClass}>
            More
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="text-base">
          <DropdownMenuItem className="text-base" onClick={() => void runTransform("professional")}>
            Professional
          </DropdownMenuItem>
          <DropdownMenuItem className="text-base" onClick={() => void runTransform("shorter")}>
            Shorter
          </DropdownMenuItem>
          <DropdownMenuItem className="text-base" onClick={() => void runTransform("clearer")}>
            Clearer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? <span className="max-w-[8rem] truncate text-base text-red-600">{error}</span> : null}
    </div>
  );
}
