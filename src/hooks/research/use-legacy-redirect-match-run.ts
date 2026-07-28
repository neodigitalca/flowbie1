import { useCallback, useRef, useState } from "react";
import type { WordPressSite } from "@/components/integrations/types";
import { loadApiKey } from "@/lib/api";
import type { PressReleaseInventoryHostedLink } from "@/lib/press-release/press-release-site-inventory";
import { runLegacyRedirectMatch } from "@/lib/sitemap-optimizer/run-legacy-redirect-match";
import type {
  LegacyRedirectBatchProgress,
  LegacyRedirectMatchProgress,
  LegacyRedirectMatchRow,
  LegacyRedirectMatchRunResult,
} from "@/lib/sitemap-optimizer/types";

export function useLegacyRedirectMatchRun() {
  const [phase, setPhase] = useState<LegacyRedirectMatchProgress["phase"]>("idle");
  const [progress, setProgress] = useState<LegacyRedirectMatchProgress>({
    phase: "idle",
    completed: 0,
    total: 0,
  });
  const [batchProgress, setBatchProgress] = useState<LegacyRedirectBatchProgress[]>([]);
  const [result, setResult] = useState<LegacyRedirectMatchRunResult | null>(null);
  const [hostedLink, setHostedLink] = useState<PressReleaseInventoryHostedLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const running = phase !== "idle" && phase !== "done" && phase !== "error";

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
    setProgress({ phase: "idle", completed: 0, total: 0 });
    setBatchProgress([]);
  }, []);

  const run = useCallback(
    async (args: {
      site: WordPressSite;
      legacySheetText: string;
      legacySheetName?: string;
      onMatch?: (match: LegacyRedirectMatchRow) => void;
      uploadUrlCount?: number;
    }) => {
      const { site, legacySheetText, legacySheetName, onMatch, uploadUrlCount } = args;
      setError(null);
      setResult(null);
      setHostedLink(null);
      setBatchProgress([]);

      const apiKey = loadApiKey()?.trim();
      if (!apiKey) {
        setError("OpenRouter API key required.");
        return { ok: false as const, error: "OpenRouter API key required." };
      }

      if (!legacySheetText.trim()) {
        setError("Upload or paste a legacy URL sheet first.");
        return { ok: false as const, error: "Upload or paste a legacy URL sheet first." };
      }

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const signal = ac.signal;

      setPhase("inventory");
      setProgress({ phase: "inventory", completed: 0, total: 1 });

      const res = await runLegacyRedirectMatch({
        site,
        legacySheetText,
        legacySheetName,
        apiKey,
        signal,
        onProgress: (p) => {
          setPhase(p.phase);
          setProgress(p);
        },
        onBatchProgress: setBatchProgress,
        onMatch,
        uploadUrlCount,
      });

      abortRef.current = null;

      if (res.ok === false) {
        const errMsg = res.error;
        if (errMsg !== "Cancelled") setError(errMsg);
        setPhase(errMsg === "Cancelled" ? "idle" : "error");
        return { ok: false as const, error: errMsg };
      }

      setResult(res.result);
      setHostedLink(res.hostedLink);
      setPhase("done");
      return { ok: true as const, result: res.result, hostedLink: res.hostedLink };
    },
    [],
  );

  return {
    phase,
    progress,
    batchProgress,
    result,
    hostedLink,
    error,
    running,
    run,
    cancel,
    setResult,
    setHostedLink,
  };
}
