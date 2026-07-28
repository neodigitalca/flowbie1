import { useState, useEffect, useRef } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { BarChart3, ChevronRight, Loader2, Upload, CheckCircle } from "lucide-react";
import { notify, notifyHeaderError } from "@/lib/app-notifications";
import { BACKEND_API_BASE as MCP_DERIVED_BACKEND } from "@/lib/wordpress-api/connection";

const BACKEND_API_BASE =
  (typeof import.meta.env.VITE_BACKEND_API_BASE === "string" ? import.meta.env.VITE_BACKEND_API_BASE : "").trim() ||
  MCP_DERIVED_BACKEND ||
  "";

export function GoogleAnalyticsSettingsContent() {
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch(`${BACKEND_API_BASE}/api/ga/credentials-status`);
      const data = await res.json().catch(() => ({}));
      setSavedEmail(data?.configured ? data?.client_email ?? "Saved" : null);
    } catch {
      setSavedEmail(null);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsUploading(true);
    try {
      const text = await file.text();
      const response = await fetch(`${BACKEND_API_BASE}/api/ga/test-and-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceAccountJson: text }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setSavedEmail(data?.client_email ?? "Saved");
        notify.success(data?.message ?? "Credentials saved.");
      } else {
        notify.error(data?.error ?? `Failed (${response.status}).`);
      }
    } catch (err) {
      notifyHeaderError("Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h3 id="ga4-heading" className="text-base font-semibold text-white">
          Google Analytics 4
        </h3>
      </div>
      <p className="text-base text-white">
        Upload the service account JSON once. Set GA4 Property ID per site in Properties → Edit site, then Test GA on the site tile.
      </p>

      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileChange}
        />
        {loadingStatus ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking…
          </div>
        ) : savedEmail ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              <span>Credentials saved: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">{savedEmail}</code></span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isUploading ? "Uploading…" : "Replace"}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="default"
            disabled={isUploading}
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isUploading ? "Uploading…" : "Upload service account file"}
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          Upload the JSON key file from Google Cloud (Credentials → Service account → Keys → Add key → JSON). Locally it’s saved and used immediately; on production use Render → Environment.
        </p>
      </div>

      <Collapsible open={instructionsOpen} onOpenChange={setInstructionsOpen} className="border border-border rounded-md bg-muted/30">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-muted/50 rounded-t-md transition-colors"
          >
            <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${instructionsOpen ? "rotate-90" : ""}`} />
            Setup instructions (Google Cloud, GA4, local & Render)
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 text-sm space-y-3 border-t border-border mt-0 pt-3 text-foreground">
            <div>
              <span className="font-semibold text-white">1. Google Cloud</span>
              <span className="text-foreground"> - Open </span>
              <a href="https://console.cloud.google.com/apis/library" target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline hover:opacity-90">API Library</a>
              <span className="text-foreground">, search for <strong className="text-white">Google Analytics Data API</strong>, open it and click <strong className="text-white">Enable</strong>.</span>
            </div>
            <div>
              <span className="font-semibold text-white">2. Service account</span>
              <span className="text-foreground"> - Go to </span>
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline hover:opacity-90">Credentials</a>
              <span className="text-foreground"> → Create credentials → Service account (or reuse your GSC one). Open it → Keys → Add key → JSON. Download and keep the file safe.</span>
            </div>
            <div>
              <span className="font-semibold text-white">3. GA4 property access</span>
              <span className="text-foreground"> - In </span>
              <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline hover:opacity-90">Google Analytics</a>
              <span className="text-foreground"> select your GA4 property → Admin (gear) → Property access management → Add users. Enter the service account </span>
              <code className="bg-muted px-1 rounded text-foreground">client_email</code>
              <span className="text-foreground"> from the JSON. Role: <strong className="text-white">Viewer</strong>. Save.</span>
            </div>
            <div>
              <span className="font-semibold text-white">4. Property ID per site</span>
              <span className="text-foreground"> - In GA4: Admin → Property settings. Copy the numeric <strong className="text-white">Property ID</strong>. When adding or editing a WordPress site, paste it in the <strong className="text-white">GA4 Property ID</strong> field for that site.</span>
            </div>
            <div>
              <span className="font-semibold text-white">5. Local credentials</span>
              <span className="text-foreground"> - In Settings, click <strong className="text-white">Upload service account file</strong> and choose your JSON key (saved and used immediately). Or put the JSON at </span>
              <code className="bg-muted px-1 rounded text-foreground">server/credentials/ga-service-account.json</code>
              <span className="text-foreground"> or set </span>
              <code className="bg-muted px-1 rounded text-foreground">GA_SERVICE_ACCOUNT_JSON</code>
              <span className="text-foreground"> in </span>
              <code className="bg-muted px-1 rounded text-foreground">.env</code>
              <span className="text-foreground">.</span>
            </div>
            <div>
              <span className="font-semibold text-white">6. Render (production)</span>
              <span className="text-foreground"> - In </span>
              <a href="https://dashboard.render.com/" target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline hover:opacity-90">Render dashboard</a>
              <span className="text-foreground"> → your flowbie-api service → Environment. Add </span>
              <code className="bg-muted px-1 rounded text-foreground">GA_SERVICE_ACCOUNT_JSON</code>
              <span className="text-foreground"> or </span>
              <code className="bg-muted px-1 rounded text-foreground">GA_SERVICE_ACCOUNT_JSON_B64</code>
              <span className="text-foreground">. Save to redeploy.</span>
            </div>
            <div>
              <span className="font-semibold text-white">7. Test</span>
              <span className="text-foreground"> - On each WordPress site tile, click <strong className="text-white">Test GA</strong>. It uses that site’s GA4 Property ID (set in Edit site).</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
