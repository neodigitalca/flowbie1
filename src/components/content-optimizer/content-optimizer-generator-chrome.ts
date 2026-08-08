import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";

/** When set, Opt renders under Generator workspace chrome instead of standalone Content chrome. */
export type ContentOptimizerGeneratorChrome = {
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  sectionSwitchDisabled?: boolean;
  showOpt?: boolean;
};
