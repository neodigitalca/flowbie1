import { openEmcp, rpc, parseRpc } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-about-tool-schema");
const res = await rpc("tools/list", {}, 2, session);
const tools = res.parsed?.result?.tools || [];
const add = tools.filter((t) => /add-free-widget|add-widget|insert/i.test(t.name));
process.stdout.write(
  `${JSON.stringify(
    add.map((t) => ({ name: t.name, desc: t.description, schema: t.inputSchema })),
    null,
    2,
  )}\n`,
);
