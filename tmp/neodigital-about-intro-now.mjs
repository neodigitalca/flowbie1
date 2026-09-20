import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-about-intro-now");
const structure = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: 129, max_depth: 6 },
  2,
);
const blob = JSON.stringify(structure.data);
const hit = blob.indexOf("6e9d357");
const hit2 = blob.indexOf("0c8b1ff");
process.stdout.write(
  `${JSON.stringify(
    {
      intro: hit >= 0 ? blob.slice(hit, hit + 1200) : "",
      wrap: hit2 >= 0 ? blob.slice(hit2, hit2 + 800) : "",
    },
    null,
    2,
  )}\n`,
);
