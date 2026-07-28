import type { WordPressSite } from "@/components/integrations/types";
import { sanitizePlaceholders } from "@/lib/content-generation/content-sanitizer";

export type PressReleasePlace = {
  city: string;
  state: string;
};

/** Default or first site location for AP-style dateline city/region. */
export function resolvePressReleasePlace(
  site: Pick<WordPressSite, "locations" | "napInfo">,
): PressReleasePlace | null {
  const locs =
    site.locations && site.locations.length > 0
      ? site.locations
      : site.napInfo?.locations;
  if (locs && locs.length > 0) {
    const pick = locs.find((l) => l.isDefault) ?? locs[0];
    const city = (pick.city ?? "").trim();
    const state = (pick.state ?? "").trim();
    if (city) return { city, state };
  }

  const addr = (site.napInfo?.address ?? "").trim();
  if (addr) return parseCityStateFromCommaAddress(addr);

  return null;
}

function parseCityStateFromCommaAddress(address: string): PressReleasePlace | null {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const city = parts[parts.length - 2];
  const last = parts[parts.length - 1];
  const stateToken = last.split(/\s+/).find((t) => t.length > 0) ?? last;
  if (!city) return null;
  return { city, state: stateToken };
}

export function formatPressReleaseCalendarDate(at: Date = new Date()): string {
  return at.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Calendar portion from a full wire dateline or a date-only string. */
export function extractPressReleaseCalendarDate(wireDateline: string): string {
  const t = wireDateline.trim();
  const tail = /([A-Za-z]+\s+\d{1,2},\s+\d{4})\s*$/.exec(t);
  return tail?.[1] ?? t;
}

/** AP-style wire dateline, e.g. `EDMONTON, Alberta, May 15, 2026` (no brackets). */
export function buildPressReleaseWireDateline(
  site: Pick<WordPressSite, "locations" | "napInfo" | "name">,
  at: Date = new Date(),
): string {
  const datePart = formatPressReleaseCalendarDate(at);
  const place = resolvePressReleasePlace(site);
  if (!place) return datePart;

  const city = place.city.toUpperCase();
  const region = place.state.trim();
  return region ? `${city}, ${region}, ${datePart}` : `${city}, ${datePart}`;
}

/** Remove repeated date prefixes from sections after the opening block. */
export function stripRepeatedPressReleaseDatePrefixes(
  markdown: string,
  wireDateline: string,
): string {
  const calendarDate = extractPressReleaseCalendarDate(wireDateline);
  if (!calendarDate.trim()) return markdown;

  const escaped = calendarDate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const linePrefixRe = new RegExp(
    `^(\\s*(?:\\*\\*)?)\\s*${escaped}\\s*[-–—]\\s*`,
    "i",
  );

  const blocks = markdown.split(/(?=^##\s)/m);
  let keptFirstDate = false;

  return blocks
    .map((block) => {
      if (!/^##\s/m.test(block)) return block;
      return block
        .split("\n")
        .map((line) => {
          if (!linePrefixRe.test(line)) return line;
          if (!keptFirstDate) {
            keptFirstDate = true;
            return line;
          }
          return line.replace(linePrefixRe, "");
        })
        .join("\n");
    })
    .join("");
}

/** Strip bracket template leftovers, empty bold shells, and repeated date prefixes. */
export function finishPressReleaseMarkdown(
  markdown: string,
  wireDateline?: string,
): string {
  let s = sanitizePlaceholders(markdown);
  if (wireDateline?.trim()) {
    s = stripRepeatedPressReleaseDatePrefixes(s, wireDateline.trim());
  }
  s = s.replace(/\*\*\s*,\s*\*\*/g, "");
  s = s.replace(/\*\*\s*—\s*\*\*/g, "");
  s = s.replace(/\*\*\s*-\s*\*\*/g, "");
  s = s.replace(/\*\*\s*\*\*/g, "");
  s = s.replace(/[ \t]{2,}/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
