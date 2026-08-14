import type { MetaAdVisualReferenceElement } from "@/lib/ppc/meta-ads-types";

export function metaVisualPlanIncludesDeviceUi(
  elements: MetaAdVisualReferenceElement[] | undefined,
): boolean {
  return (elements ?? []).some((element) => element.kind === "device");
}
