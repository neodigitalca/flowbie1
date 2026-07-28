import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Loader2 } from "lucide-react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import {
  BULK_HEADER_RUN_BTN,
  BULK_HEADER_SELECT_TRIGGER,
  BULK_HEADER_TOOL_BTN,
  BULK_TOOLBAR_GROUP_DIVIDER,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { useManagerSeedWorkspace } from "@/contexts/manager-seed-workspace-context";
import { getCyberpunkTextClasses } from "@/components/integrations/wordpress/cyberpunk-theme";
import { buildTempLocalAnalysisSite } from "@/lib/temp-local-analysis-site";
import {
  clearGridLocalScan,
  downloadGridLocalResultsCsv,
  downloadGridLocalSearchReport,
  GRID_LOCAL_MAPS_ZOOM,
  GRID_LOCAL_PIN_COUNT,
  gridLocalScanReportLines,
  rankPinColor,
  readGridLocalScan,
  runGridLocalScan,
  type GridLocalPin,
  type GridLocalScan,
} from "@/lib/grid-local/grid-local";
import { wordpressSiteDisplayName } from "@/lib/wordpress-site-display-name";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import { cn } from "@/lib/utils";

const GRID_LOCAL_SHELL_CLASS =
  "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-3 pt-3 px-3 pb-4 md:px-5 md:pt-4";

const GRID_LOCAL_HEADER_CLASS = "relative z-[1100] shrink-0 overflow-visible";

const GRID_LOCAL_MAP_BODY_CLASS =
  "relative z-0 min-h-0 flex-1 overflow-hidden [&_.leaflet-container]:z-0 [&_.leaflet-pane]:z-0";

const DETAILS_PANEL_ID = "grid-local-details-panel";
const RADIUS_OPTIONS = [3, 5, 8] as const;

function pinDivIcon(pin: GridLocalPin): L.DivIcon {
  const color = rankPinColor(pin.rank);
  const label = pin.rank != null ? String(pin.rank) : "—";
  const border = pin.isCenter ? "2px solid #fff" : "2px solid #18181b";
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#000;font-weight:700;font-size:14px;border:${border}">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function MapFitBounds({ pins }: { pins: GridLocalPin[] }) {
  const map = useMap();
  useEffect(() => {
    if (!pins.length) return;
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48] });
  }, [map, pins]);
  return null;
}

function GridLocalDetailsPanel({ log }: { log: string[] }) {
  return (
    <div className="max-h-[min(70vh,32rem)] space-y-1 overflow-y-auto p-3 font-mono text-base text-muted-foreground">
      {log.length === 0 ? (
        <p>No pin results yet.</p>
      ) : (
        log.map((line, i) => <div key={`${i}-${line.slice(0, 24)}`}>{line}</div>)
      )}
    </div>
  );
}

function SummaryCard({ scan }: { scan: GridLocalScan }) {
  const s = scan.stats;
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-[1000] max-w-xs space-y-2 bg-zinc-900/95 p-3 text-base text-foreground">
      <p className="font-semibold leading-snug">{scan.businessName}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-muted-foreground">Avg. Rank</span>
        <span className="text-2xl font-bold">{s.avgRank != null ? s.avgRank.toFixed(2) : "—"}</span>
      </div>
      <div className="grid grid-cols-4 gap-1 text-center text-base">
        <div><div className="text-muted-foreground">High</div><div>{s.distribution.high}%</div></div>
        <div><div className="text-muted-foreground">Med</div><div>{s.distribution.med}%</div></div>
        <div><div className="text-muted-foreground">Low</div><div>{s.distribution.low}%</div></div>
        <div><div className="text-muted-foreground">Out</div><div>{s.distribution.out}%</div></div>
      </div>
      <p className="text-muted-foreground">Keyword: {scan.keyword}</p>
      <p className="text-muted-foreground">TARP: {s.tarp != null ? s.tarp.toFixed(2) : "—"}</p>
    </div>
  );
}

export function GridLocalShell() {
  const { enabledSites, connectedSite, canUseConnected } = useManagerSeedWorkspace();
  const site = useMemo(() => {
    if (enabledSites.length === 0) return buildTempLocalAnalysisSite("");
    return connectedSite ?? enabledSites[0];
  }, [enabledSites, connectedSite]);

  const siteLabel = wordpressSiteDisplayName(site);
  const [keyword, setKeyword] = useState("blinds near me");
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [scan, setScan] = useState<GridLocalScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [completedPins, setCompletedPins] = useState(0);
  const [pinLog, setPinLog] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!site.id) return;
    const saved = readGridLocalScan(site.id);
    if (saved) {
      setScan(saved);
      setKeyword(saved.keyword);
      setRadiusKm(saved.radiusKm);
      setPinLog(gridLocalScanReportLines(saved));
    } else {
      setScan(null);
      setPinLog([]);
    }
    setStatusMessage(null);
  }, [site.id]);

  const handleRun = useCallback(async () => {
    if (!site.id || !keyword.trim()) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setScanning(true);
    setCompletedPins(0);
    setPinLog(["Reading GBP address from Master Rules…"]);
    setStatusMessage("Reading GBP address from Master Rules…");
    try {
      const result = await runGridLocalScan({
        site,
        keyword,
        radiusKm,
        signal: ac.signal,
        onGridReady: (gridScan) => {
          setScan({ ...gridScan, pins: [...gridScan.pins] });
          setPinLog((prev) => [...prev, `Grid ready: ${gridScan.pins.length} pins around ${gridScan.businessName}`]);
          setStatusMessage("Scanning keyword at each pin…");
        },
        onStatus: (msg) => {
          setStatusMessage(msg);
          setPinLog((prev) => [...prev, msg]);
        },
        onProgress: (done) => setCompletedPins(done),
        onPinComplete: (pin, s) => {
          setScan({ ...s, pins: [...s.pins] });
          const coord = pin.locationCoordinate ?? `${pin.lat.toFixed(7)},${pin.lng.toFixed(7)},${GRID_LOCAL_MAPS_ZOOM}`;
          if (pin.apiError) {
            setPinLog((prev) => [...prev, `ERROR @ ${coord}: ${pin.apiError}`]);
            return;
          }
          const top = pin.serp?.slice(0, 3).map((r) => `#${r.rank} ${r.title}`).join(" | ") ?? "";
          setPinLog((prev) => [
            ...prev,
            top
              ? `rank ${pin.rank ?? "out"} @ ${coord} (${pin.serp?.length ?? 0} listings) — ${top}`
              : `rank ${pin.rank ?? "out"} @ ${coord} (0 listings)`,
          ]);
        },
      });
      setScan(result);
      const reportLines = gridLocalScanReportLines(result);
      setPinLog(reportLines);
      downloadGridLocalSearchReport(result);
      downloadGridLocalResultsCsv(result);
      setStatusMessage(
        `Scan complete. Report downloaded (${result.pins.filter((p) => p.rank != null).length} ranked pins). Open Details for full log.`,
      );
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatusMessage(msg);
        setPinLog((prev) => [...prev, `Error: ${msg}`]);
      }
    } finally {
      setScanning(false);
    }
  }, [site, keyword, radiusKm]);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    if (site.id) clearGridLocalScan(site.id);
    setScan(null);
    setPinLog([]);
    setCompletedPins(0);
    setStatusMessage(null);
  }, [site.id]);

  const progressSnapshot = useMemo((): MetaBulkMicroSnapshot | null => {
    if (!scanning) return null;
    return {
      label: "Grid scan",
      completed: completedPins,
      total: GRID_LOCAL_PIN_COUNT,
      statusMessage: statusMessage ?? `${completedPins} / ${GRID_LOCAL_PIN_COUNT} keyword searches`,
      progressPct: Math.round((completedPins / GRID_LOCAL_PIN_COUNT) * 100),
    };
  }, [scanning, completedPins, statusMessage]);

  const mapCenter = scan?.center ?? { lat: 49.895, lng: -97.138 };
  const displayPins = scan?.pins ?? [];
  const detailsLog = pinLog.length > 0 ? pinLog : statusMessage ? [statusMessage] : [];

  if (!canUseConnected || enabledSites.length === 0) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
          <p className={`text-base ${getCyberpunkTextClasses("muted")}`}>
            Add a WordPress property under Dashboard → Properties, then open Grid Local to scan local pack
            rankings for a keyword across a coordinate grid.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={GRID_LOCAL_SHELL_CLASS}>
      <div className={GRID_LOCAL_HEADER_CLASS}>
        <UnifiedWorkspaceChrome
          icon={Crosshair}
          title="Grid Local"
          titleRowEnd={
            <span className="truncate text-base text-muted-foreground">{siteLabel}</span>
          }
          detailsDrawerClassName="z-[1200]"
          toolbar={
            <>
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Keyword e.g. blinds near me"
                className={cn(BULK_HEADER_SELECT_TRIGGER, "w-56 max-w-[40vw]")}
                disabled={scanning}
              />
              <Select
                value={String(radiusKm)}
                onValueChange={(v) => setRadiusKm(Number(v))}
                disabled={scanning}
              >
                <SelectTrigger className={cn(BULK_HEADER_SELECT_TRIGGER, "w-28")}>
                  <SelectValue placeholder="Radius" />
                </SelectTrigger>
                <SelectContent>
                  {RADIUS_OPTIONS.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {r} km
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className={BULK_TOOLBAR_GROUP_DIVIDER} />
              <Button
                type="button"
                className={BULK_HEADER_RUN_BTN}
                disabled={scanning || !keyword.trim()}
                onClick={() => void handleRun()}
              >
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Run Now
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={BULK_HEADER_TOOL_BTN}
                disabled={!scan}
                onClick={() => scan && downloadGridLocalSearchReport(scan)}
              >
                Download Report
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={BULK_HEADER_TOOL_BTN}
                disabled={!scan}
                onClick={() => scan && downloadGridLocalResultsCsv(scan)}
              >
                Export CSV
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={BULK_HEADER_TOOL_BTN}
                disabled={scanning && completedPins === 0}
                onClick={handleClear}
              >
                Clear
              </Button>
            </>
          }
          workspaceBusy={scanning}
          isProcessing={scanning}
          canOpenDetails={detailsLog.length > 0 || scanning}
          progressSnapshot={progressSnapshot}
          detailsPanelId={DETAILS_PANEL_ID}
          detailsPanel={<GridLocalDetailsPanel log={detailsLog} />}
        />
      </div>

      <div className={GRID_LOCAL_MAP_BODY_CLASS}>
        {scan ? <SummaryCard scan={scan} /> : null}
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={12}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {displayPins.length > 0 ? <MapFitBounds pins={displayPins} /> : null}
          {displayPins.map((pin, i) => (
            <Marker key={`${pin.lat}-${pin.lng}-${i}`} position={[pin.lat, pin.lng]} icon={pinDivIcon(pin)} />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
