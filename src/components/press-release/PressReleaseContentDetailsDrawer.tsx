import { BulkGeneratorDetailsDrawer } from "@/components/keyword-research/bulk/BulkGeneratorDetailsDrawer";
import type { PressReleaseDetailsPanelProps } from "@/components/press-release/PressReleaseDetailsPanel";
import { buildPressReleaseBulkGeneratorDetailsProps } from "@/lib/press-release/press-release-bulk-details-bindings";

export function PressReleaseContentDetailsDrawer(
  props: PressReleaseDetailsPanelProps & { workspaceBusy?: boolean },
) {
  const drawerProps = buildPressReleaseBulkGeneratorDetailsProps(props);
  return (
    <BulkGeneratorDetailsDrawer
      variant="csv"
      postDestination="wordpress"
      wpConfig={null}
      {...drawerProps}
    />
  );
}
