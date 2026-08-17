import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { validateAutomationPlan } from "@/lib/automation-planner-compile";
import type { AutomationPlan } from "@/lib/automation-planner-types";

export type AutomationJsonPanelHandle = {
  flushPendingPlan: () => AutomationPlan | null;
};

export type AutomationJsonPanelProps = {
  plan: AutomationPlan;
  disabled?: boolean;
  onPlanChange: (plan: AutomationPlan) => void;
};

export const AutomationJsonPanel = forwardRef<AutomationJsonPanelHandle, AutomationJsonPanelProps>(
  function AutomationJsonPanel({ plan, disabled = false, onPlanChange }, ref): React.ReactElement {
    const planJson = useMemo(() => JSON.stringify(plan, null, 2), [plan]);
    const [text, setText] = useState(planJson);
    const [dirty, setDirty] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    const applyParsedPlan = useCallback(
      (parsed: AutomationPlan): AutomationPlan | null => {
        const errors = validateAutomationPlan(parsed);
        setValidationErrors(errors);
        if (errors.length > 0) {
          return null;
        }
        onPlanChange(parsed);
        setDirty(false);
        return parsed;
      },
      [onPlanChange],
    );

    useImperativeHandle(
      ref,
      () => ({
        flushPendingPlan: () => {
          if (!dirty) return null;
          try {
            const parsed = JSON.parse(text) as AutomationPlan;
            setParseError(null);
            return applyParsedPlan(parsed);
          } catch {
            setParseError("Invalid JSON");
            setValidationErrors(["Invalid JSON"]);
            return null;
          }
        },
      }),
      [applyParsedPlan, dirty, text],
    );

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
          applyParsedPlan(parsed);
        } catch {
          setParseError("Invalid JSON");
          setValidationErrors(["Invalid JSON"]);
        }
      }, 400);
      return () => window.clearTimeout(handle);
    }, [applyParsedPlan, dirty, text]);

    return (
      <div className="flex h-full min-h-0 flex-col gap-1 pt-1">
        <Textarea
          value={text}
          onChange={(e) => {
            setDirty(true);
            setText(e.target.value);
          }}
          disabled={disabled}
          className="min-h-0 flex-1 resize-none rounded-none border-0 bg-zinc-950 font-mono text-base text-white"
          spellCheck={false}
        />
        {parseError ? <p className="shrink-0 text-base text-red-400">{parseError}</p> : null}
        {validationErrors.length > 0 && !parseError ? (
          <ul className="shrink-0 text-base text-red-400">
            {validationErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  },
);
