import type { WordPressSite } from "@/components/integrations/types";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";
import type { PressReleaseInventoryHostedLink } from "@/lib/press-release/press-release-site-inventory";

export type PressReleaseWorkspaceBindings = {
  keyword: string;
  setKeyword: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  isProcessing: boolean;
  runPhase: string;
  onRun: () => void;
  onClear: () => void;
  harnessSections: BulkHarnessSectionUi[];
  harnessPlannedSectionCount: number | null;
  inventoryJsonLink: PressReleaseInventoryHostedLink | null;
  wordPressSite: WordPressSite | null;
  resultMarkdown: string | null;
};
