import type { WordPressSite } from "@/components/integrations/types";
import type { ContentOptimizerSectionId } from "@/components/content-optimizer/content-optimizer-sections";
import type { ContentOptimizerGeneratorChrome } from "@/components/content-optimizer/content-optimizer-generator-chrome";

export interface OverviewTabContentProps {
  site: WordPressSite;
  apiKey: string;
  selectedModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  optimizerSection: ContentOptimizerSectionId;
  onOptimizerSectionChange: (id: ContentOptimizerSectionId) => void;
  /** Shared max row count for pagination slot width (single + multi). */
  paginationLayoutTotal: number;
  generatorChrome?: ContentOptimizerGeneratorChrome;
}
