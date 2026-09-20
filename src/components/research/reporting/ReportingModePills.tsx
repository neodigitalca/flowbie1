import { WorkspacePill } from "@/components/shared/WorkspacePill";

export type ReportingWorkspaceMode = "seo" | "ppc";

const MODES: { id: ReportingWorkspaceMode; label: string }[] = [
  { id: "seo", label: "SEO" },
  { id: "ppc", label: "PPC" },
];

export function ReportingModePills({
  mode,
  onModeChange,
  disabled = false,
}: {
  mode: ReportingWorkspaceMode;
  onModeChange: (mode: ReportingWorkspaceMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1" aria-label="Report type">
      {MODES.map(({ id, label }) => (
        <WorkspacePill
          key={id}
          label={label}
          active={mode === id}
          disabled={disabled}
          onClick={() => onModeChange(id)}
        />
      ))}
    </div>
  );
}
