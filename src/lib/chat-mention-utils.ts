/** Parse TipTap mention spans from chat message HTML. */
export function extractMentionUserIds(bodyHtml: string): number[] {
  if (typeof document !== "undefined") {
    const div = document.createElement("div");
    div.innerHTML = bodyHtml;
    const spans = div.querySelectorAll('span[data-type="mention"][data-id]');
    const ids = new Set<number>();
    spans.forEach((el) => {
      const id = Number(el.getAttribute("data-id"));
      if (Number.isFinite(id) && id > 0) ids.add(id);
    });
    return [...ids];
  }

  const ids = new Set<number>();
  const re = /data-type="mention"[^>]*data-id="(\d+)"|data-id="(\d+)"[^>]*data-type="mention"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyHtml)) !== null) {
    const id = Number(m[1] ?? m[2]);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  }
  return [...ids];
}
