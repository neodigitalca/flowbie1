import React from "react";
import { ContentOptimizerShell, type ContentOptimizerShellProps } from "./ContentOptimizerShell";

export type ContentOptimizerTabContentProps = ContentOptimizerShellProps;

export const ContentOptimizerTabContent: React.FC<ContentOptimizerTabContentProps> = (props) => {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <ContentOptimizerShell {...props} />
    </div>
  );
};
