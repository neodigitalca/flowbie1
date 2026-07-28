import { useCallback, useRef, useState } from "react";
import type { WordPressSite } from "@/components/integrations/types";
import { loadApiKey } from "@/lib/api";
import { runRedirectMatcher } from "@/lib/redirect-matcher/run-redirect-matcher";
import type {
  LegacyUrlRow,
  RedirectMatcherProgress,
  RedirectMatcherRunResult,
} from "@/lib/redirect-matcher/types";

export function useRedirectMatcherRun() {
  const [phase, setPhase] = useState<RedirectMatcherProgress["phase"]>("idle");
  const [progress, setProgress] = useState<RedirectMatcherProgress>({
    phase: "idle",
    completed: 0,
    total: 0,
  });
  const [result, setResult] = useState<RedirectMatcherRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const running = phase !== "idle" && phase !== "done" && phase !== "error";

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
    setProgress({ phase: "idle", completed: 0, total: 0 });
  }, []);

  const run = useCallback(
    async (args: { site: WordPressSite; legacyRows: LegacyUrlRow[] }) => {
      const { site, legacyRows } = args;
      setError(null);
      setResult(null);

      const apiKey = loadApiKey()?.trim();
      if (!apiKey) {
        setError("OpenRouter API key required.");
        return { ok: false as const, error: "OpenRouter API key required." };
      }

      if (!legacyRows.length) {
        setError("Upload a CSV or paste legacy URLs first.");
        return { ok: false as const, error: "Upload a CSV or paste legacy URLs first." };
      }

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const signal = ac.signal;

      setPhase("parse");
      setProgress({ phase: "parse", completed: 0, total: legacyRows.length });

      const res = await runRedirectMatcher({
        site,
        legacyRows,
        apiKey,
        signal,
        onProgress: (p) => {
          setPhase(p.phase);
          setProgress(p);
        },
      });

      abortRef.current = null;

      if (res.ok === false) {
        const errMsg = res.error;
        if (errMsg !== "Cancelled") setError(errMsg);
        setPhase(errMsg === "Cancelled" ? "idle" : "error");
        return { ok: false as const, error: errMsg };
      }

      setResult(res.result);
      setPhase("done");
      return { ok: true as const, result: res.result };
    },
    [],
  );

  return { phase, progress, result, error, running, run, cancel, setResult };
}
