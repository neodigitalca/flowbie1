import { describe, expect, it } from "vitest";
import { createWorkflowNode } from "@/lib/workflow/workflow-graph-mutations";
import {
  thenEmailDisplayLabel,
  withThenEmailRecipientSync,
} from "@/lib/workflow/workflow-then-utils";
import type { WorkflowThenStepConfig } from "@/lib/workflow/workflow-types";

describe("then email label sync", () => {
  it("prefers To address over a stale node label", () => {
    const node = createWorkflowNode("then_email", "sean@neodigital.ca");
    node.config = {
      ...(node.config as WorkflowThenStepConfig),
      executionPayload: {
        sendAutomationEmail: true,
        automationEmailTo: "matt@neodigital.ca",
      },
    };
    expect(thenEmailDisplayLabel(node)).toBe("matt@neodigital.ca");
  });

  it("syncs label and To together", () => {
    const node = createWorkflowNode("then_email", "Email");
    const next = withThenEmailRecipientSync(node, "matt@neodigital.ca");
    expect(next.label).toBe("matt@neodigital.ca");
    expect(
      (next.config as WorkflowThenStepConfig).executionPayload?.automationEmailTo,
    ).toBe("matt@neodigital.ca");
    expect(thenEmailDisplayLabel(next)).toBe("matt@neodigital.ca");
  });
});
