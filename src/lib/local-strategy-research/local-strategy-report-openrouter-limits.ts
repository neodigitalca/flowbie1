/** Micro-stepper total for the local strategy report pipeline (wire + 13 sections + assemble). */
export const LOCAL_STRATEGY_REPORT_MICRO_TOTAL = 15 as const;

export type LocalStrategyReportMicroStepPayload = {
  step: number;
  total: typeof LOCAL_STRATEGY_REPORT_MICRO_TOTAL;
  label: string;
};
