/**
 * Deterministic wrapper for Overview harness HTML so themes can style `.flo-overview`.
 */

export const FLO_OVERVIEW_CLASS = "flo-overview";

const OPEN_PREFIX = `<div class="${FLO_OVERVIEW_CLASS}">`;

function isAlreadyWrapped(html: string): boolean {
  const t = html.trimStart().toLowerCase();
  return (
    t.startsWith(`<div class="${FLO_OVERVIEW_CLASS}"`) ||
    t.startsWith(`<div class='${FLO_OVERVIEW_CLASS}'`)
  );
}

/** Wrap Overview section HTML in `<div class="flo-overview">`. Idempotent. */
export function wrapOverviewSectionHtml(html: string): string {
  const t = (html ?? "").trim();
  if (!t) return t;
  if (isAlreadyWrapped(t)) return t;
  return `${OPEN_PREFIX}\n${t}\n</div>`;
}
