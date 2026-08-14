import React from "react";
import { PpcShell, type PpcShellProps } from "./PpcShell";

export type PpcTabContentProps = PpcShellProps & {
  onPlatformChange: (tab: "ppc-google" | "ppc-meta") => void;
};

export const PpcTabContent: React.FC<PpcTabContentProps> = ({ onPlatformChange, ...props }) => {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <PpcShell {...props} onPlatformChange={onPlatformChange} />
    </div>
  );
};
