import { WorkspacePill } from "@/components/shared/WorkspacePill";

export type PpcPlatformTab = "ppc-google" | "ppc-meta";

export type PpcPlatformPillsProps = {
  active: PpcPlatformTab;
  onSelect: (tab: PpcPlatformTab) => void;
  disabled?: boolean;
};

export function PpcPlatformPills({ active, onSelect, disabled = false }: PpcPlatformPillsProps) {
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1" role="group" aria-label="PPC platform">
      <WorkspacePill
        label="Google"
        active={active === "ppc-google"}
        square
        disabled={disabled}
        onClick={() => onSelect("ppc-google")}
      />
      <WorkspacePill
        label="Meta"
        active={active === "ppc-meta"}
        square
        disabled={disabled}
        onClick={() => onSelect("ppc-meta")}
      />
    </div>
  );
}
