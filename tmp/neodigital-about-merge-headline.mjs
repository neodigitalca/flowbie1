import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 129;
const TITLE =
  'Our Difference? We Actually Give A <span class="highlight-primary">Sh*t.</span><br>...When You <span class="highlight-primary">Succeed</span> We <span class="highlight-primary">Succeed.</span>';

const session = await openEmcp("neo-pulse-about-merge-headline");
let id = 2;

const updated = await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: "0f70bcb",
    settings: {
      title: TITLE,
      header_size: "span",
    },
  },
  id++,
);

const dropped = await callTool(
  session,
  "emcp-tools-remove-element",
  { post_id: POST_ID, element_id: "251eaca" },
  id++,
);

const moved = await callTool(
  session,
  "emcp-tools-move-element",
  {
    post_id: POST_ID,
    element_id: "0f70bcb",
    target_parent_id: "5c4f099",
    position: 3,
  },
  id++,
);

const unwrapped = await callTool(
  session,
  "emcp-tools-remove-element",
  { post_id: POST_ID, element_id: "b104736" },
  id++,
);

const after = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: "0f70bcb" },
  id++,
);

process.stdout.write(
  `${JSON.stringify(
    {
      updated: updated.data,
      dropped: dropped.data,
      moved: moved.data,
      unwrapped: unwrapped.data,
      title: after.data?.settings?.title,
      tag: after.data?.settings?.header_size,
    },
    null,
    2,
  )}\n`,
);
