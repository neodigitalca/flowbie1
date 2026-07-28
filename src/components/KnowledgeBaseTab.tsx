import { KnowledgeBaseShell } from "@/components/knowledge-base/KnowledgeBaseShell";
import { useKnowledgeBase } from "@/hooks/knowledge-base/use-knowledge-base";
import type { StoredFile } from "@/lib/knowledge-base/types";

export type { StoredFile } from "@/lib/knowledge-base/types";

export interface KnowledgeBaseTabProps {
  onFilesUpdate: (files: StoredFile[]) => void;
  onManualContentUpdate: (content: string) => void;
  currentFiles: StoredFile[];
}

export const KnowledgeBaseTab: React.FC<KnowledgeBaseTabProps> = ({
  onFilesUpdate,
  onManualContentUpdate,
  currentFiles,
}) => {
  const controller = useKnowledgeBase({
    currentFiles,
    onFilesUpdate,
    onManualContentUpdate,
  });

  return <KnowledgeBaseShell controller={controller} />;
};
