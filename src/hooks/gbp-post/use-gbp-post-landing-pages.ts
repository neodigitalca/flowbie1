import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { WordPressSite } from "@/components/integrations/types";
import {
  buildGbpLandingPageAssignments,
  loadGbpLandingPageCandidatesForSites,
} from "@/lib/gbp-post/gbp-post-landing-pages";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";

export type UseGbpPostLandingPagesOptions = {
  rosterSites: WordPressSite[];
  sitemapSource: OverviewSitemapSource;
  isBusy: boolean;
  landingPageUrlBySiteId: Record<string, string>;
  setLandingPageUrlBySiteId: Dispatch<SetStateAction<Record<string, string>>>;
};

export function useGbpPostLandingPages({
  rosterSites,
  sitemapSource,
  isBusy,
  landingPageUrlBySiteId,
  setLandingPageUrlBySiteId,
}: UseGbpPostLandingPagesOptions) {
  const [candidatesBySiteId, setCandidatesBySiteId] = useState<Record<string, string[]>>({});
  const [landingPagesLoading, setLandingPagesLoading] = useState(false);
  const landingPageUrlRef = useRef(landingPageUrlBySiteId);
  landingPageUrlRef.current = landingPageUrlBySiteId;

  const rosterKey = useMemo(
    () =>
      rosterSites
        .map((s) => `${s.id}:${s.username ?? ""}:${s.appPassword ?? ""}`)
        .sort()
        .join("|"),
    [rosterSites],
  );

  const applyAssignments = useCallback(
    (assignments: Record<string, string>) => {
      setLandingPageUrlBySiteId((prev) => {
        const next = { ...prev };
        for (const site of rosterSites) {
          next[site.id] = assignments[site.id] ?? "";
        }
        return next;
      });
    },
    [rosterSites, setLandingPageUrlBySiteId],
  );

  const refreshLandingPages = useCallback(async () => {
    if (!rosterSites.length) {
      setCandidatesBySiteId({});
      return;
    }
    setLandingPagesLoading(true);
    try {
      const candidates = await loadGbpLandingPageCandidatesForSites(rosterSites, sitemapSource);
      setCandidatesBySiteId(candidates);
      const assignments = buildGbpLandingPageAssignments(rosterSites, candidates, "initial");
      applyAssignments(assignments);
    } finally {
      setLandingPagesLoading(false);
    }
  }, [applyAssignments, rosterSites, sitemapSource]);

  useEffect(() => {
    void refreshLandingPages();
  }, [refreshLandingPages, rosterKey, sitemapSource]);

  const shuffleLandingPages = useCallback(() => {
    if (isBusy || !rosterSites.length) return;
    const assignments = buildGbpLandingPageAssignments(
      rosterSites,
      candidatesBySiteId,
      "shuffle",
      landingPageUrlRef.current,
    );
    applyAssignments(assignments);
  }, [applyAssignments, candidatesBySiteId, isBusy, rosterSites]);

  const canShuffle = useMemo(
    () =>
      !isBusy &&
      rosterSites.some((site) => (candidatesBySiteId[site.id]?.length ?? 0) > 0),
    [candidatesBySiteId, isBusy, rosterSites],
  );

  return {
    shuffleLandingPages,
    canShuffle,
  };
}
