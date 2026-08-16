import { useCallback, useState } from "react";
import { ResearchGeneratorSection } from "@/components/generator/ResearchGeneratorSection";
import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";

/** @deprecated Use Generator → Research pill via BlogGeneratorShell. */
export const ResearchWorkspaceShell: React.FC = () => {
  const [section, setSection] = useState<BlogGeneratorSectionId>("research");
  const onSectionChange = useCallback((id: BlogGeneratorSectionId) => {
    setSection(id);
  }, []);

  return <ResearchGeneratorSection activeSection={section} onSectionChange={onSectionChange} />;
};
