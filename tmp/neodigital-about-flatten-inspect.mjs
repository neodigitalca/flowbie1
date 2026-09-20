import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-about-flatten-inspect");
let id = 2;

let pages;
try {
  pages = await callTool(session, "emcp-tools-list-pages", { search: "about" }, id++);
} catch (e) {
  pages = { data: { error: String(e) } };
}

let listed = pages.data;
if (listed && typeof listed === "object" && listed.text) {
  try {
    listed = JSON.parse(listed.text);
  } catch {
    listed = listed;
  }
}

const candidates = listed?.pages || listed?.items || listed?.posts || listed || [];
const rows = Array.isArray(candidates) ? candidates : [];
const about =
  rows.find((p) => String(p?.link || p?.url || "").includes("/about/")) ||
  rows.find((p) => String(p?.slug || "") === "about") ||
  null;

process.stdout.write(
  `${JSON.stringify(
    {
      listType: typeof listed,
      listKeys: listed && typeof listed === "object" ? Object.keys(listed) : [],
      rowCount: rows.length,
      sample: rows.slice(0, 3),
      about,
    },
    null,
    2,
  )}\n`,
);
