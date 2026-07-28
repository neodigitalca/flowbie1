import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_OPENROUTER_API_KEY_REQUIRED, NOTIFY_SET_GOOGLE_BUSINESS_PROFILE_LOCATION_ID_, notifyPublishedToGbpForX } from "@/lib/notify-messages";
import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import { loadApiKey } from "@/lib/api";
import type { WordPressSite } from "@/components/integrations/types";
import type { GmbContentRow } from "./GmbContentTable";

const PLATFORMS = {
  gmb: {
    label: "Google Business Profile",
    maxChars: 1500,
    maxWords: 150,
    hashtags: false,
    cta: true,
    tone: "local-business conversational",
  },
  facebook: {
    label: "Facebook",
    maxChars: 2000,
    maxWords: 200,
    hashtags: true,
    cta: true,
    tone: "friendly and engaging",
  },
  instagram: {
    label: "Instagram",
    maxChars: 2200,
    maxWords: 200,
    hashtags: true,
    cta: true,
    tone: "visual and aspirational",
  },
  linkedin: {
    label: "LinkedIn",
    maxChars: 3000,
    maxWords: 250,
    hashtags: true,
    cta: true,
    tone: "professional and authoritative",
  },
  x: {
    label: "X (Twitter)",
    maxChars: 280,
    maxWords: 40,
    hashtags: true,
    cta: false,
    tone: "concise and punchy",
  },
} as const;

type PlatformKey = keyof typeof PLATFORMS;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: GmbContentRow | null;
  site: WordPressSite;
}

export const SocialMediaModal: React.FC<Props> = ({
  open,
  onOpenChange,
  row,
  site,
}) => {
  const [platform, setPlatform] = useState<PlatformKey>("gmb");
  const [copy, setCopy] = useState("");
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    if (open) {
      setCopy("");
      setPublished(false);
    }
  }, [open, row]);

  const pc = PLATFORMS[platform];
  const charCount = copy.length;
  const isOver = charCount > pc.maxChars;

  const getApiKey = () =>
    loadApiKey()?.trim() ||
    (typeof import.meta !== "undefined"
      ? import.meta.env.VITE_OPENROUTER_API_KEY
      : "") ||
    "";

  const handleGenerate = useCallback(async () => {
    if (!row) return;
    setGenerating(true);
    setPublished(false);
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        notify.error(NOTIFY_OPENROUTER_API_KEY_REQUIRED);
        return;
      }

      const res = await fetch(
        `${BACKEND_API_BASE}/api/gmb/generate-social-copy`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteUrl: site.siteUrl,
            username: site.username,
            appPassword: site.appPassword,
            title: row.title,
            url: row.url,
            excerpt: row.excerpt,
            platform,
            maxChars: pc.maxChars,
            maxWords: pc.maxWords,
            tone: pc.tone,
            hashtags: pc.hashtags,
            cta: pc.cta,
            openRouterApiKey: apiKey,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (res.ok && typeof data.copy === "string") {
        setCopy(data.copy);
      } else {
        notify.error(
          typeof data.error === "string"
            ? data.error
            : "Failed to generate copy.",
        );
      }
    } catch (e) {
      notify.error(
        e instanceof Error ? e.message : "Failed to generate copy.",
      );
    } finally {
      setGenerating(false);
    }
  }, [row, site, platform, pc]);

  const handlePublishGbp = useCallback(async () => {
    if (!row || !copy.trim()) return;
    const gbpLocationId = site.gbpLocationId?.trim();
    if (!gbpLocationId) {
      notify.error(NOTIFY_SET_GOOGLE_BUSINESS_PROFILE_LOCATION_ID_);
      return;
    }
    setPublishing(true);
    try {
      const apiKey = getApiKey();
      const res = await fetch(
        `${BACKEND_API_BASE}/api/gmb/publish-from-harness`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteUrl: site.siteUrl,
            username: site.username,
            appPassword: site.appPassword,
            gbpLocationId,
            keyword: row.title,
            siteName: site.name,
            blogPostUrl: row.url,
            blogPostTitle: row.title,
            blogPostExcerpt: row.excerpt,
            preGeneratedCopy: copy.trim(),
            publish: true,
            existingGbpPosts: [],
            ...(apiKey ? { openRouterApiKey: apiKey } : {}),
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (res.ok && data.success) {
        setPublished(true);
        notify.success(notifyPublishedToGbpForX(row.title));
      } else {
        notify.error(
          typeof data.error === "string"
            ? data.error
            : "Failed to publish to GBP.",
        );
      }
    } catch (e) {
      notify.error(
        e instanceof Error ? e.message : "Failed to publish to GBP.",
      );
    } finally {
      setPublishing(false);
    }
  }, [row, site, copy]);

  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Social Media Module</DialogTitle>
          <DialogDescription className="truncate">
            {row.title}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Platform selector */}
          <div className="flex flex-col gap-1.5">
            <Label>Platform</Label>
            <Select
              value={platform}
              onValueChange={(v) => {
                setPlatform(v as PlatformKey);
                setCopy("");
                setPublished(false);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PLATFORMS).map(([key, p]) => (
                  <SelectItem key={key} value={key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Max {pc.maxChars} chars / {pc.maxWords} words
              {pc.hashtags ? " · hashtags" : ""}
              {pc.cta ? " · CTA" : ""}
            </p>
          </div>

          {/* Source post info */}
          <div className="rounded-md border border-border/40 bg-muted/20 px-3 py-2">
            <p className="text-sm font-medium text-foreground line-clamp-1">
              {row.title}
            </p>
            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary"
            >
              {row.url.replace(/^https?:\/\//, "")}
            </a>
          </div>

          {/* Copy area */}
          <div className="flex flex-col gap-1.5">
            <Label>{pc.label} Copy</Label>
            <Textarea
              rows={6}
              value={copy}
              onChange={(e) => {
                setCopy(e.target.value);
                setPublished(false);
              }}
              placeholder={
                generating
                  ? "Generating..."
                  : `Click "Generate" to create optimized copy for ${pc.label}`
              }
              disabled={generating}
            />
            <p
              className={`text-right text-xs tabular-nums ${isOver ? "font-semibold text-destructive" : "text-muted-foreground"}`}
            >
              {charCount} / {pc.maxChars} characters
            </p>
          </div>

          {published && (
            <div className="rounded-md bg-green-50 px-3 py-2 text-sm font-semibold text-green-600 dark:bg-green-950/30 dark:text-green-400">
              Published to {pc.label}!
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            onClick={handleGenerate}
            disabled={generating || publishing}
            className="gap-1.5"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? "Generating..." : "Generate"}
          </Button>
          {platform === "gmb" && (
            <Button
              onClick={handlePublishGbp}
              disabled={!copy.trim() || generating || publishing || published}
              variant="default"
              className="gap-1.5 bg-green-700 hover:bg-green-800"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Megaphone className="h-4 w-4" />
              )}
              {publishing ? "Publishing..." : "Publish to GBP"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
