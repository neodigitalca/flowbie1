/**
 * Visible-tab /api route registry parity (used by contract tests).
 */
export const NEO_PULSE_APP_VISIBLE_TAB_ROUTES = [
  { method: "POST", path: "wordpress/test-connection" },
  { method: "POST", path: "gsc/fetch-reporting-bundle" },
  { method: "POST", path: "dataforseo/competitor-research" },
  { method: "POST", path: "proposal/site-audit" },
  { method: "POST", path: "seo/discover-locations" },
  { method: "GET", path: "vertical-benchmarks/taxonomy" },
  { method: "GET", path: "ga/credentials-status" },
  { method: "GET", path: "gmb/config-status" },
  { method: "POST", path: "gmb/performance" },
];

export const NEO_PULSE_APP_PHASE1_ROUTES = NEO_PULSE_APP_VISIBLE_TAB_ROUTES;

export const NEO_PULSE_APP_DISPATCHER_MARKERS = [
  "Neo_Pulse_App_Wp_Route_Handlers::handle",
  "Neo_Pulse_App_Gsc_Route_Handlers::dispatch_http",
  "Neo_Pulse_App_Ga_Route_Handlers::dispatch_http",
  "Neo_Pulse_App_Gmb_Route_Handlers::dispatch_http",
  "Neo_Pulse_App_Dataforseo_Route_Handlers::dispatch_http",
  "Neo_Pulse_App_Semrush_Route_Handlers::dispatch_http",
  "Neo_Pulse_App_Proposal_Route_Handlers::dispatch_http",
  "Neo_Pulse_App_Seo_Route_Handlers::dispatch_http",
  "Neo_Pulse_App_Vertical_Benchmark_Route_Handlers::dispatch_http",
  "Neo_Pulse_App_Site_Scraper_Route_Handlers::dispatch_http",
  "Neo_Pulse_App_Knowledge_Model_Route_Handlers::dispatch_http",
  "Neo_Pulse_App_Images_Route_Handlers::dispatch_http",
  "Neo_Pulse_App_Integrations_Route_Handlers::dispatch_http",
  "Neo_Pulse_App_Manager_Route_Handlers::dispatch_cloud",
  "Neo_Pulse_App_Bulk_Validate_Links::stream",
  "Neo_Pulse_App_Wikipedia_Proxy::proxy_query",
  "Neo_Pulse_App_Entity_Maps_Image::generate",
];
