import React, { useEffect, useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { validateAutomationPlan } from "@/lib/automation-planner-compile";
import type { AutomationPlan } from "@/lib/automation-planner-types";

export type AutomationJsonPanelProps = {
  plan: AutomationPlan;
  disabled?: boolean;
  onPlanChange: (plan: AutomationPlan) => void;
};

export function AutomationJsonPanel({
  plan,
  disabled = false,
  onPlanChange,
}: AutomationJsonPanelProps): React.ReactElement {
  const planJson = useMemo(() => JSON.stringify(plan, null, 2), [plan]);
  const [text, setText] = useState(planJson);
  const [dirty, setDirty] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!dirty) {
      setText(planJson);
      setValidationErrors(validateAutomationPlan(plan));
    }
  }, [dirty, plan, planJson]);

  useEffect(() => {
    if (!dirty) return;
    const handle = window.setTimeout(() => {
      try {
        const parsed = JSON.parse(text) as AutomationPlan;
        setParseError(null);
        const errors = validateAutomationPlan(parsed);
        setValidationErrors(errors);
        if (errors.length === 0) {
          onPlanChange(parsed);
          setDirty(false);
        }
      } catch {
        setParseError("Invalid JSON");
        setValidationErrors(["Invalid JSON"]);
      }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [dirty, onPlanChange, text]);

  return (
    <div className="flex min-h-[320px] flex-col gap-2">
      <Textarea
        value={text}
        onChange={(e) => {
          setDirty(true);
          setText(e.target.value);
        }}
        disabled={disabled}
        className="min-h-[280px] flex-1 resize-y rounded-none border-0 bg-zinc-950 font-mono text-base text-white"
        spellCheck={false}
      />
      {parseError ? <p className="text-base text-red-400">{parseError}</p> : null}
      {validationErrors.length > 0 && !parseError ? (
        <ul className="text-base text-red-400">
          {validationErrors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
