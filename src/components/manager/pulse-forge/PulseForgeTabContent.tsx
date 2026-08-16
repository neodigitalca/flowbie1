import React from "react";
import { PulseForgeShell } from "@/components/manager/pulse-forge/PulseForgeShell";

export function PulseForgeTabContent(): React.ReactElement {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <PulseForgeShell />
    </div>
  );
}
