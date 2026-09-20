import React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Link2, List, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveHtmlAssetUrls } from "@/lib/elementor-page-content/resolve-html-asset-urls";
import { normalizeSectionProseHtml } from "@/lib/elementor-page-content/extract-text-editor-prose";

const EDITOR_CONTENT_CLASS =
  "overview-section-prose-editor min-h-24 w-full px-3 py-2 text-base leading-relaxed text-white outline-none [&_.ProseMirror]:min-h-24 [&_.ProseMirror]:outline-none [&_a]:text-cyan-400 [&_a]:underline [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5";

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      className={cn(
        "h-8 w-8 shrink-0 rounded-none border-0 text-muted-foreground hover:bg-white/10 hover:text-white",
        active && "bg-white/10 text-white",
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function OverviewSectionProseEditor({
  value,
  readOnly = false,
  placeholder = "Section copy",
  siteUrl,
  className,
  onChange,
}: {
  value: string;
  readOnly?: boolean;
  placeholder?: string;
  siteUrl?: string;
  className?: string;
  onChange?: (html: string) => void;
}) {
  const resolvedValue = React.useMemo(() => {
    const normalized = normalizeSectionProseHtml(value);
    return siteUrl?.trim() ? resolveHtmlAssetUrls(normalized, siteUrl) : normalized;
  }, [value, siteUrl]);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const focusedRef = React.useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [2, 3] },
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: resolvedValue || "",
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => {
      onChangeRef.current?.(ed.getHTML());
    },
    onFocus: () => {
      focusedRef.current = true;
    },
    onBlur: () => {
      focusedRef.current = false;
    },
    editorProps: {
      attributes: {
        class: EDITOR_CONTENT_CLASS,
      },
    },
  });

  React.useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  React.useEffect(() => {
    if (!editor || focusedRef.current) return;
    const current = editor.getHTML();
    if (current !== resolvedValue) {
      editor.commands.setContent(resolvedValue || "", { emitUpdate: false });
    }
  }, [editor, resolvedValue]);

  const addLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  if (!editor) {
    return <div className={cn("min-h-24 bg-zinc-900", className)} />;
  }

  return (
    <div
      className={cn(
        "rounded-none border-0 bg-zinc-900 shadow-inner shadow-black/40",
        className,
      )}
    >
      {!readOnly ? (
        <div className="flex items-center gap-1 border-0 border-b border-white/10 px-2 py-1">
          <ToolbarButton
            active={editor.isActive("bold")}
            label="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            label="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("link")} label="Link" onClick={addLink}>
            <Link2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("bulletList")}
            label="Bullet list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("orderedList")}
            label="Numbered list"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}
