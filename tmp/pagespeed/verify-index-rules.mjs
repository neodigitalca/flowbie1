import { uploadNeodigitalPhp } from "../../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const phpInner = `
$att = get_posts( array( 'post_type' => 'attachment', 'post_status' => 'inherit', 'numberposts' => 1, 'fields' => 'ids' ) );
$att_url = isset( $att[0] ) ? get_permalink( (int) $att[0] ) : '';
$lib = get_posts( array( 'post_type' => 'elementor_library', 'post_status' => 'publish', 'numberposts' => 1, 'fields' => 'ids' ) );
$lib_url = isset( $lib[0] ) ? get_permalink( (int) $lib[0] ) : '';
echo wp_json_encode( array(
  'attachment' => $att_url,
  'template' => $lib_url,
  'thank_you' => get_permalink( get_page_by_path( 'thank-you' ) ),
  'about' => get_permalink( get_page_by_path( 'about' ) ),
  'post' => get_permalink( get_posts( array( 'post_type' => 'post', 'post_status' => 'publish', 'numberposts' => 1 ) )[0] ?? 0 ),
) );
`;

const { url } = await uploadNeodigitalPhp(phpInner, "nd-verify-index-urls");
const probe = JSON.parse(await (await fetch(url, { cache: "no-store" })).text());
console.log("probe", probe);

async function check(label, target, opts = {}) {
  const res = await fetch(target, { redirect: "manual", cache: "no-store", ...opts });
  const loc = res.headers.get("location") || "";
  const body = await res.text();
  const noindex = /noindex/i.test(body) || /noindex/i.test(res.headers.get("x-robots-tag") || "");
  const indexable = /<meta[^>]+robots[^>]+/i.exec(body)?.[0] || res.headers.get("x-robots-tag") || "";
  console.log(label, res.status, "noindex=" + noindex, loc.slice(0, 80), indexable.slice(0, 120));
  return { status: res.status, noindex, loc, body };
}

const robots = await check("robots", "https://neodigital.ca/robots.txt");
console.log(robots.body);
const sm = await check("sitemap", "https://neodigital.ca/sitemap_index.xml");
const kids = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log("sitemap_children", kids);
if (probe.attachment) await check("attachment", probe.attachment);
if (probe.template) await check("template", probe.template);
if (probe.thank_you) await check("thank-you", probe.thank_you);
if (probe.about) await check("about", probe.about);
if (probe.post) await check("post", probe.post);
await check("paged", "https://neodigital.ca/blog/page/2/");
