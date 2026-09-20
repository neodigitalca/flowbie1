import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-inspect-other-heroes");

const localSeo = await callTool(session, "emcp-tools-get-page-structure", { post_id: 10439, max_depth: 4 }, 1);
const webDesign = await callTool(session, "emcp-tools-get-page-structure", { post_id: 4017, max_depth: 4 }, 2);

console.log("LOCAL SEO HERO:", JSON.stringify(localSeo.data?.structure?.[0], null, 2));
console.log("WEB DESIGN HERO:", JSON.stringify(webDesign.data?.structure?.[0], null, 2));
