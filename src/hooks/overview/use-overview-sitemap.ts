import { useCallback, useState } from "react";
import type { WordPressSite } from "@/components/integrations/types";
import { parseSitemap } from "@/lib/wordpress-api";
import {
  resolveOverviewSitemapUrls,
  type OverviewSitemapSource,
} from "@/lib/overview/overview-sitemap-source";
import { filterOverviewUtilityUrls } from "@/lib/overview/overview-utility-page-filter";

interface UseOverviewSitemapResult {
  loading: boolean;
  error: string | null;
  urls: string[];
  loadSitemap: (sitemapUrl: string) => Promise<string[]>;
  loadOverviewSitemapSource: (
    site: WordPressSite,
    source: OverviewSitemapSource,
  ) => Promise<string[]>;
}

/**
 * Lightweight hook to load URLs from a public sitemap into the Overview grid.
 * Uses the existing WordPress `parseSitemap` backend endpoint.
 */
export function useOverviewSitemap(): UseOverviewSitemapResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<string[]>([]);

  const loadSitemap = useCallback(async (sitemapUrl: string) => {
    const trimmed = sitemapUrl.trim();
    if (!trimmed) {
      setError("Please enter a sitemap URL.");
      setUrls([]);
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const origin = new URL(trimmed).origin;
      const result = await parseSitemap(origin, trimmed, undefined, undefined);
      const loadedUrls = Array.isArray(result?.urls) ? result.urls : [];

      if (!loadedUrls.length) {
        setError("No URLs found in sitemap.");
      }

      setUrls(loadedUrls);
      return loadedUrls;
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load sitemap. Ensure the backend is running and the sitemap URL is correct.";
      setError(message);
      setUrls([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOverviewSitemapSource = useCallback(
    async (site: WordPressSite, source: OverviewSitemapSource) => {
      const sitemapUrls = resolveOverviewSitemapUrls(site, source);
      if (!sitemapUrls.length) {
        setError(null);
        setUrls([]);
        return [];
      }

      setLoading(true);
      setError(null);

      try {
        const user = site.username?.trim();
        const pass = site.appPassword?.trim();
        const hasCreds = Boolean(user && pass);
        const origin = site.siteUrl.replace(/\/+$/, "");

        const results = await Promise.all(
          sitemapUrls.map(async (sitemapUrl) => {
            const result = await parseSitemap(
              origin,
              sitemapUrl,
              hasCreds ? user : undefined,
              hasCreds ? pass : undefined,
            );
            const batch = Array.isArray(result?.urls) ? result.urls : [];
            return batch;
          }),
        );

        const merged: string[] = [];
        const seen = new Set<string>();
        for (const batch of results) {
          for (const url of batch) {
            if (typeof url !== "string" || !url.trim()) continue;
            const trimmed = url.trim();
            const key = trimmed.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(trimmed);
          }
        }

        if (!merged.length) {
          setError("No URLs found in sitemap.");
        }

        const filtered = source === "pages" ? filterOverviewUtilityUrls(merged) : merged;
        setUrls(filtered);
        return filtered;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load sitemap. Ensure the backend is running and the sitemap URL is correct.";
        setError(message);
        setUrls([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    loading,
    error,
    urls,
    loadSitemap,
    loadOverviewSitemapSource,
  };
}
