import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 55;
const WIDGETS = ["c8e2940", "0024fe2", "4996389"];
const session = await openEmcp("neo-pulse-counters-green");
let id = 2;

const results = [];
for (const w of WIDGETS) {
  // Read existing settings
  const existing = await callTool(
    session,
    "emcp-tools-get-element-settings",
    { post_id: POST_ID, element_id: w },
    id++,
  );
  const globals = { ...(existing.data?.settings?.__globals__ || {}) };
  delete globals.digit_stroke_color;
  delete globals.digit_color;

  const res = await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: w,
      settings: {
        digit_stroke_effect: "no",
        digit_color: "#84BD00",
        digit_label_color: "#84BD00",
        __globals__: globals,
      },
    },
    id++,
  );
  results.push({ id: w, ok: res.data?.success === true });
}

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
