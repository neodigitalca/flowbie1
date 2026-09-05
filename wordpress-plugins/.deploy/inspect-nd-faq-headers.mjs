const bust = Date.now();
async function inspect(label, url) {
  const res = await fetch(url, {
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache", "User-Agent": "Mozilla/5.0 FlowbieAudit" },
  });
  const html = await res.text();
  const headEnd = html.toLowerCase().indexOf("</head>");
  const head = headEnd > 0 ? html.slice(0, headEnd) : "";
  const idx = head.indexOf("What exactly defines Local SEO");
  const around = idx >= 0 ? head.slice(Math.max(0, idx - 120), idx + 80).replace(/\s+/g, " ") : "NOT_IN_HEAD";
  console.log(
    JSON.stringify({
      label,
      status: res.status,
      cache: res.headers.get("x-cache") || res.headers.get("cf-cache-status") || res.headers.get("age"),
      xcache: res.headers.get("x-cache"),
      wpe: res.headers.get("wpe-backend") || res.headers.get("x-wpe-loopback"),
      faqPage: /FAQPage/.test(head),
      rawEchoNearQuestion: around,
    }),
  );
}
await inspect("canonical", "https://neodigital.ca/blog/seo-specialist/");
await inspect("bust", `https://neodigital.ca/blog/seo-specialist/?n=${bust}`);
