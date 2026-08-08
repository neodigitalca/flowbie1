---
title: Streaming responses
slug: getting-started/streaming
section: Getting started
order: 30
---

Some endpoints return **NDJSON** (`Content-Type: application/x-ndjson`) instead of a single JSON object. Each line is one JSON value.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/site-scraper/scrape` | Scrape progress events |
| POST | `/api/bulk/validate-internal-links` | Link validation progress |
| POST | `/api/vertical-benchmarks/export-gsc-csv` | Export progress |

## Reading NDJSON

```javascript
const res = await fetch("/api/site-scraper/scrape", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://example.com" }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (line.trim()) console.log(JSON.parse(line));
  }
}
```

## Node.js

Use `fetch` with async iteration over the body, or pipe through a line splitter. Persist cookies if the stream endpoint requires a session.
