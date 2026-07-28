/**
 * Visible-tab /api route registry parity (used by contract tests).
 */
export const FLOWBIE_APP_VISIBLE_TAB_ROUTES = [
  { method: "POST", path: "wordpress/test-connection" },
  { method: "POST", path: "gsc/fetch-reporting-bundle" },
  { method: "POST", path: "dataforseo/competitor-research" },
  { method: "POST", path: "proposal/site-audit" },
  { method: "POST", path: "seo/discover-locations" },
  { method: "POST", path: "grid-local/maps-serp-batch" },
  { method: "GET", path: "vertical-benchmarks/taxonomy" },
  { method: "GET", path: "ga/credentials-status" },
  { method: "GET", path: "gmb/config-status" },
  { method: "POST", path: "gmb/performance" },
];

export const FLOWBIE_APP_PHASE1_ROUTES = FLOWBIE_APP_VISIBLE_TAB_ROUTES;

export const FLOWBIE_APP_DISPATCHER_MARKERS = [
  "Flowbie_App_Wp_Route_Handlers::handle",
  "Flowbie_App_Gsc_Route_Handlers::dispatch_http",
  "Flowbie_App_Ga_Route_Handlers::dispatch_http",
  "Flowbie_App_Gmb_Route_Handlers::dispatch_http",
  "Flowbie_App_Dataforseo_Route_Handlers::dispatch_http",
  "Flowbie_App_Semrush_Route_Handlers::dispatch_http",
  "Flowbie_App_Proposal_Route_Handlers::dispatch_http",
  "Flowbie_App_Seo_Route_Handlers::dispatch_http",
  "Flowbie_App_Grid_Local_Route_Handlers::dispatch_http",
  "Flowbie_App_Vertical_Benchmark_Route_Handlers::dispatch_http",
  "Flowbie_App_Site_Scraper_Route_Handlers::dispatch_http",
  "Flowbie_App_Knowledge_Model_Route_Handlers::dispatch_http",
  "Flowbie_App_Images_Route_Handlers::dispatch_http",
  "Flowbie_App_Integrations_Route_Handlers::dispatch_http",
  "Flowbie_App_Manager_Route_Handlers::dispatch_cloud",
  "Flowbie_App_Bulk_Validate_Links::stream",
  "Flowbie_App_Wikipedia_Proxy::proxy_query",
  "Flowbie_App_Google_Maps_Screenshot::generate",
];
