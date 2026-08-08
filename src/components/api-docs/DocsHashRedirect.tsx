import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { getDefaultApiDocSlug } from "@/lib/api-docs";

/** Legacy /docs/* bookmarks → in-app #api/slug hash. */
export function DocsHashRedirect() {
  const params = useParams();
  const splat = params["*"];

  useEffect(() => {
    const slug = splat?.replace(/^\/+|\/+$/g, "") || getDefaultApiDocSlug();
    const base = import.meta.env.BASE_URL.replace(/\/$/, "") || "";
    window.location.replace(`${base}/#api/${slug}`);
  }, [splat]);

  return null;
}
