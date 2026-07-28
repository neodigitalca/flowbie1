import React from "react";
import { PpcShell, type PpcShellProps } from "./PpcShell";

export type PpcTabContentProps = PpcShellProps;

export const PpcTabContent: React.FC<PpcTabContentProps> = (props) => {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <PpcShell {...props} />
    </div>
  );
};
