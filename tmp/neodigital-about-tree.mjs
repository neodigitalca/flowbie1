import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 129;
const session = await openEmcp("neo-pulse-about-tree");
let id = 2;

const structure = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: POST_ID, max_depth: 8 },
  id++,
);
const blob = JSON.stringify(structure.data);

const whoAt = blob.indexOf("Who We Are");
const oilersAt = blob.indexOf("Oilers");
const teamAt = blob.indexOf("Our Team");
const mattAt = blob.indexOf("Matt");

process.stdout.write(
  `${JSON.stringify(
    {
      who: whoAt >= 0 ? blob.slice(Math.max(0, whoAt - 400), whoAt + 1800) : "",
      oilers: oilersAt >= 0 ? blob.slice(Math.max(0, oilersAt - 200), oilersAt + 400) : "",
      team: teamAt >= 0 ? blob.slice(Math.max(0, teamAt - 400), teamAt + 2200) : "",
      matt: mattAt >= 0 ? blob.slice(Math.max(0, mattAt - 400), mattAt + 1800) : "",
    },
    null,
    2,
  )}\n`,
);
