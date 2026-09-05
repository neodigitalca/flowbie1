export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "navigate",
      description: "Navigate the browser to a URL.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wait",
      description: "Wait for milliseconds before the next screenshot.",
      parameters: {
        type: "object",
        properties: { ms: { type: "number" } },
        required: ["ms"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete",
      description: "Finish when the goal is done or you cannot continue.",
      parameters: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          summary: { type: "string" },
          notes: { type: "string" },
        },
        required: ["success", "summary"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "report_blocked",
      description: "Report captcha, bot check, or login wall and stop.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reload_page",
      description: "Refresh the current page.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "go_back",
      description: "Go back in browser history.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "wait_for_text",
      description: "Wait until visible page text contains the given string.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          timeoutMs: { type: "number" },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wait_for_url",
      description: "Wait until the current URL contains the given substring.",
      parameters: {
        type: "object",
        properties: {
          contains: { type: "string" },
          timeoutMs: { type: "number" },
        },
        required: ["contains"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "scroll_to_top",
      description: "Scroll to the top of the page.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "scroll_to_bottom",
      description: "Scroll to the bottom of the page.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "type_at",
      description: "Click a text field at coordinates and type into it.",
      parameters: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
          text: { type: "string" },
          label: { type: "string" },
        },
        required: ["x", "y", "text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "click_at",
      description: "Click a visible control at viewport pixel coordinates.",
      parameters: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
          label: { type: "string" },
        },
        required: ["x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "type",
      description: "Type into the focused field.",
      parameters: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "press_key",
      description: "Press a keyboard key (Enter, Tab, Escape, etc.).",
      parameters: {
        type: "object",
        properties: { key: { type: "string" } },
        required: ["key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "scroll",
      description: "Scroll the page up or down.",
      parameters: {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["up", "down"] },
          amount: { type: "number" },
        },
        required: ["direction"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "select_option",
      description: "Select an option from a visible dropdown by CSS selector.",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string" },
          value: { type: "string" },
        },
        required: ["selector", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fill_form_fields",
      description: "Fill multiple form fields by label or name.",
      parameters: {
        type: "object",
        properties: {
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: "string" },
              },
              required: ["label", "value"],
            },
          },
        },
        required: ["fields"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_page_info",
      description: "Read URL, title, HTTP status from preflight, and ready state.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "extract_page_meta",
      description: "Extract title, meta description, canonical, and H1.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "extract_visible_text",
      description: "Extract main visible page text (hero/body).",
      parameters: {
        type: "object",
        properties: { maxChars: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_page_links",
      description: "List links on the page with text and href.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify_page_contains",
      description: "Check if visible page text contains a phrase.",
      parameters: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "extract_competitor_headings",
      description: "Extract H1, H2, and H3 headings from the page.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "capture_screenshot",
      description: "Capture and save a screenshot deliverable.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string" },
          filename: { type: "string" },
          fullPage: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_text_deliverable",
      description: "Save markdown or text to the run archive and RAG.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string" },
          filename: { type: "string" },
          content: { type: "string" },
          mime: { type: "string" },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_csv_deliverable",
      description: "Save CSV content to the run archive and RAG.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string" },
          filename: { type: "string" },
          content: { type: "string" },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "audit_page_html",
      description:
        "Audit page HTML quality and HTTP status. On failure saves issues CSV and fix plan markdown.",
      parameters: {
        type: "object",
        properties: {
          savePassReport: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "audit_site_pages",
      description:
        "Programmatic multi-page site health check. Discovers URLs from sitemap and internal links, visits each page, checks HTTP status, response time, meta, and H1, then saves one CSV row per page.",
      parameters: {
        type: "object",
        properties: {
          maxPages: {
            type: "number",
            description: "Max pages to check. Omit when auditAll is true.",
          },
          auditAll: {
            type: "boolean",
            description: "When true, audit every discoverable internal page from sitemap and links (up to 2000).",
          },
          startUrl: { type: "string", description: "Optional start URL; defaults to current page." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_serp",
      description: "Fetch Google organic results via DataForSEO API.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          location: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url_status",
      description: "Check HTTP status for one or more URLs.",
      parameters: {
        type: "object",
        properties: {
          urls: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["urls"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_serp_result",
      description: "Navigate to a search_serp organic result by 1-based index.",
      parameters: {
        type: "object",
        properties: { index: { type: "number" } },
        required: ["index"],
      },
    },
  },
];
