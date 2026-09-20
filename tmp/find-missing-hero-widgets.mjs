import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-find-missing");
for (const search_text of ["2bbef65", "Edmonton SEO built", "Edmonton Agency", "4f337d2"]) {
  const r = await callTool(session, "emcp-tools-find-element", { post_id: 10203, search_text }, 1);
  console.log(search_text, JSON.stringify(r.data, null, 2).slice(0, 800));
}
