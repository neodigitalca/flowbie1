import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 55;
const session = await openEmcp("neo-pulse-counters-inspect-04e1b1a");
const widgets = ["04e1b1a", "0ed5015"];
for (const w of widgets) {
  const r = await callTool(
    session,
    "emcp-tools-get-element-settings",
    { post_id: POST_ID, element_id: w },
    2,
  );
  const s = r.data?.settings;
  console.log(w, {
    starting_number: s.starting_number,
    suffix: s.suffix,
    title_text: s.title_text,
    counter_color: s.counter_color,
    counter_text_stroke_text_stroke_type: s.counter_text_stroke_text_stroke_type,
    counter_text_stroke_text_stroke: s.counter_text_stroke_text_stroke,
    counter_text_stroke_stroke_color: s.counter_text_stroke_stroke_color,
    __globals__: s.__globals__,
  });
}
