import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 163;
const session = await openEmcp("neo-pulse-apply-two-row-footer");
let id = 2;

const ROW1_HTML = `<div class="neo-footer-cta-card">
  <div class="neo-cta-kicker">
    <span>WORK WITH US &rarr;</span>
  </div>
  <div class="neo-cta-center">
    <a href="https://neodigital.ca/contact/" class="neo-cta-title">Let&rsquo;s Work Together</a>
  </div>
  <div class="neo-cta-action">
    <a class="neo-cta-arrow-btn" href="https://neodigital.ca/contact/" aria-label="Contact Neo Digital">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <polyline points="12 5 19 12 12 19"></polyline>
      </svg>
    </a>
  </div>
</div>
<style>
.neo-footer-cta-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  background-color: #FFFFFF;
  padding: 32px 48px;
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 40px;
}
.neo-cta-kicker {
  flex: 0 0 auto;
}
.neo-cta-kicker span {
  font-family: "Lato", sans-serif !important;
  font-size: 1rem !important;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #02050A !important;
  text-transform: uppercase;
}
.neo-cta-center {
  flex: 1 1 auto;
  text-align: center;
  padding: 0 20px;
}
.neo-cta-title {
  font-family: "Lato", sans-serif !important;
  font-size: 3.25rem !important;
  font-weight: 700 !important;
  color: #02050A !important;
  text-decoration: none !important;
  line-height: 1.1 !important;
  white-space: nowrap !important;
  display: inline-block;
  transition: color 0.2s ease;
}
.neo-cta-title:hover {
  color: #84BD00 !important;
}
.neo-cta-action {
  flex: 0 0 auto;
}
.neo-cta-arrow-btn {
  display: flex !important;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 68px;
  border-radius: 50% !important;
  background-color: #84BD00 !important;
  color: #02050A !important;
  text-decoration: none !important;
  transition: transform 0.2s ease, background-color 0.2s ease;
}
.neo-cta-arrow-btn:hover {
  background-color: #99d600 !important;
  transform: scale(1.08);
}
@media (max-width: 1024px) {
  .neo-cta-title {
    font-size: 2.25rem !important;
  }
  .neo-footer-cta-card {
    padding: 24px 32px;
  }
}
@media (max-width: 767px) {
  .neo-footer-cta-card {
    flex-direction: column;
    gap: 16px;
    text-align: center;
    padding: 28px 20px;
  }
  .neo-cta-title {
    font-size: 1.75rem !important;
    white-space: normal !important;
  }
}
</style>`;

const ROW2_HTML = `<div class="neo-footer-strip">
  <div class="neo-col-about">
    <a href="https://neodigital.ca/" class="neo-footer-logo-link">
      <img src="https://neodigital.ca/wp-content/uploads/2025/02/Light.svg" alt="Neo Digital Logo" class="neo-footer-logo" />
    </a>
    <p class="neo-footer-about-text">
      Neo Digital is an Edmonton digital marketing agency specializing in high-performance 
      <a href="https://neodigital.ca/website-design/">Website Design</a>, 
      <a href="https://neodigital.ca/elementor-help/">Elementor Experts</a> support, 
      data-driven <a href="https://neodigital.ca/edmonton-seo/">Edmonton SEO</a> &amp; 
      <a href="https://neodigital.ca/local-seo/">Local SEO</a>, 
      next-gen <a href="https://neodigital.ca/aiseo/">AISEO</a>, and 
      <a href="https://neodigital.ca/google-ads/">Google Ads</a>.
    </p>
  </div>

  <div class="neo-col-services">
    <h4 class="neo-footer-heading">SERVICES</h4>
    <ul class="neo-footer-links">
      <li><a href="https://neodigital.ca/edmonton-seo/">Edmonton SEO</a></li>
      <li><a href="https://neodigital.ca/website-design/">Website Design</a></li>
      <li><a href="https://neodigital.ca/elementor-help/">Elementor Experts</a></li>
      <li><a href="https://neodigital.ca/local-seo/">Local SEO</a></li>
      <li><a href="https://neodigital.ca/aiseo/">AISEO</a></li>
      <li><a href="https://neodigital.ca/google-ads/">Google Ads</a></li>
    </ul>
  </div>

  <div class="neo-col-quicklinks">
    <h4 class="neo-footer-heading">QUICK LINKS</h4>
    <ul class="neo-footer-links">
      <li><a href="https://neodigital.ca/">Home</a></li>
      <li><a href="https://neodigital.ca/about/">About Us</a></li>
      <li><a href="https://neodigital.ca/our-work/">Our Work</a></li>
      <li><a href="https://neodigital.ca/blog/">Blog</a></li>
      <li><a href="https://neodigital.ca/contact/">Contact</a></li>
      <li><a href="https://neodigital.ca/service-area/">Service Areas</a></li>
    </ul>
  </div>

  <div class="neo-col-connect">
    <h4 class="neo-footer-heading">CONNECT</h4>
    <a href="tel:+15879916288" class="neo-footer-phone">+1 (587) 991-6288</a>
    <div class="neo-footer-social">
      <a href="https://www.facebook.com/edmontonwebdesign/" target="_blank" rel="noopener">Facebook &rarr;</a>
      <a href="https://www.instagram.com/neodigitalca" target="_blank" rel="noopener">Instagram &rarr;</a>
    </div>
    <div class="neo-footer-badge">
      <img src="https://neodigital.ca/wp-content/uploads/2025/08/Health-Canada-Warning.png" alt="Health Canada Warning" class="neo-trust-img" />
    </div>
    <div class="neo-footer-legal">
      <span>&copy; Neo Digital Inc.</span> &middot; <a href="https://neodigital.ca/privacy-policy/">Privacy Policy</a>
    </div>
  </div>
</div>
<style>
.neo-footer-strip {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
  gap: 32px;
  box-sizing: border-box;
  padding: 10px 0 30px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding-top: 40px;
}
.neo-col-about {
  flex: 0 0 32%;
  max-width: 32%;
}
.neo-footer-logo {
  max-width: 190px;
  height: auto;
  display: block;
  margin-bottom: 16px;
}
.neo-footer-about-text {
  font-family: "Lato", sans-serif !important;
  font-size: 1rem !important;
  line-height: 1.6 !important;
  color: #a8adb7 !important;
  margin: 0 !important;
}
.neo-footer-about-text a {
  color: #ffffff !important;
  font-weight: 600;
  text-decoration: underline !important;
  text-underline-offset: 3px;
  transition: color 0.2s ease;
}
.neo-footer-about-text a:hover {
  color: #84BD00 !important;
}
.neo-col-services {
  flex: 0 0 20%;
  max-width: 20%;
}
.neo-col-quicklinks {
  flex: 0 0 18%;
  max-width: 18%;
}
.neo-col-connect {
  flex: 0 0 24%;
  max-width: 24%;
}
.neo-footer-heading {
  font-family: "Lato", sans-serif !important;
  font-size: 0.875rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.1em !important;
  color: #ffffff !important;
  text-transform: uppercase !important;
  margin: 0 0 16px 0 !important;
}
.neo-footer-links {
  list-style: none !important;
  padding: 0 !important;
  margin: 0 !important;
}
.neo-footer-links li {
  list-style: none !important;
  margin: 0 0 8px 0 !important;
  padding: 0 !important;
}
.neo-footer-links a {
  font-family: "Lato", sans-serif !important;
  font-size: 1rem !important;
  color: #a8adb7 !important;
  text-decoration: none !important;
  line-height: 1.5 !important;
  transition: color 0.2s ease;
}
.neo-footer-links a:hover {
  color: #84BD00 !important;
}
.neo-footer-phone {
  font-family: "Lato", sans-serif !important;
  font-size: 1.125rem !important;
  font-weight: 700 !important;
  color: #ffffff !important;
  text-decoration: none !important;
  display: block;
  margin-bottom: 14px;
  transition: color 0.2s ease;
}
.neo-footer-phone:hover {
  color: #84BD00 !important;
}
.neo-footer-social {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.neo-footer-social a {
  font-family: "Lato", sans-serif !important;
  font-size: 1rem !important;
  color: #84BD00 !important;
  text-decoration: none !important;
  font-weight: 600;
}
.neo-footer-social a:hover {
  text-decoration: underline;
}
.neo-trust-img {
  max-width: 170px;
  height: auto;
  display: block;
  margin-bottom: 14px;
}
.neo-footer-legal {
  font-family: "Lato", sans-serif !important;
  font-size: 0.875rem !important;
  color: #6c727d !important;
}
.neo-footer-legal a {
  color: #a8adb7 !important;
  text-decoration: none !important;
}
.neo-footer-legal a:hover {
  color: #ffffff !important;
}

@media (max-width: 1024px) {
  .neo-footer-strip {
    flex-wrap: wrap;
    gap: 24px;
  }
  .neo-col-about {
    flex: 0 0 100%;
    max-width: 100%;
    margin-bottom: 10px;
  }
  .neo-col-services,
  .neo-col-quicklinks,
  .neo-col-connect {
    flex: 0 0 30%;
    max-width: 30%;
  }
}
@media (max-width: 767px) {
  .neo-footer-strip {
    flex-direction: column;
    gap: 24px;
  }
  .neo-col-about,
  .neo-col-services,
  .neo-col-quicklinks,
  .neo-col-connect {
    flex: 0 0 100%;
    max-width: 100%;
  }
}
</style>`;

// 1. Update 56cfa90 container settings (Row 1)
await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: "56cfa90",
    settings: {
      content_width: "full",
      flex_direction: "column",
      padding: { unit: "px", top: "40", right: "0", bottom: "0", left: "0", isLinked: false },
      _title: "Row 1 - Full Width CTA",
    },
  },
  id++,
);

// Remove old child elements in 56cfa90
const toRemove = ["a043362", "24fc949", "98d96a2"];
for (const elId of toRemove) {
  try {
    await callTool(
      session,
      "emcp-tools-remove-element",
      { post_id: POST_ID, element_id: elId },
      id++,
    );
  } catch (e) {}
}

// Add the HTML widget for Row 1
const addRow1Widget = await callTool(
  session,
  "emcp-tools-add-free-widget",
  {
    post_id: POST_ID,
    parent_id: "56cfa90",
    position: 0,
    widget_type: "html",
    settings: {
      html: ROW1_HTML,
    },
  },
  id++,
);
console.log({ addRow1Widget: addRow1Widget.data });

// 2. Update 780eb96 container settings (Row 2)
await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: "780eb96",
    settings: {
      content_width: "full",
      flex_direction: "column",
      padding: { unit: "px", top: "0", right: "0", bottom: "20", left: "0", isLinked: false },
      margin: { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: true },
      border_border: "none",
      _title: "Row 2 - Info Strip",
    },
  },
  id++,
);

// Remove old child elements in 780eb96
try {
  await callTool(
    session,
    "emcp-tools-remove-element",
    { post_id: POST_ID, element_id: "f8ee0bb" },
    id++,
  );
} catch (e) {}

// Add the HTML widget for Row 2
const addRow2Widget = await callTool(
  session,
  "emcp-tools-add-free-widget",
  {
    post_id: POST_ID,
    parent_id: "780eb96",
    position: 0,
    widget_type: "html",
    settings: {
      html: ROW2_HTML,
    },
  },
  id++,
);
console.log({ addRow2Widget: addRow2Widget.data });

// Remove decorative image 43e39a8 if still present
try {
  await callTool(
    session,
    "emcp-tools-remove-element",
    { post_id: POST_ID, element_id: "43e39a8" },
    id++,
  );
} catch (e) {}

console.log("Two row footer applied successfully!");
