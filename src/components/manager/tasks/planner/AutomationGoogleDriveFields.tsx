import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskFormInfieldSelect } from "@/components/manager/tasks/TaskFormLayout";
import { WorkspacePill } from "@/components/shared/WorkspacePill";
import {
  openGoogleDriveAuthorize,
  useGoogleDriveConnectionStatus,
} from "@/hooks/use-google-drive-connection-status";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import {
  DRIVE_MONTH_SEGMENTS,
  GOOGLE_DRIVE_PATH_PRESETS,
  driveYearSelectOptions,
  formatDriveMonthSegment,
  formatDriveYearSegment,
  googleDrivePurposeFolderLabel,
  isDriveCalendarMonth,
  isDriveCalendarYear,
  type GoogleDriveFolderPurposeKey,
} from "@/lib/google-drive/google-drive-folder-hierarchy";
import {
  findGoogleDriveFolderPresetByFolderId,
  formatGoogleDriveFolderUrl,
  listGoogleDriveFolderPresets,
  parseGoogleDriveFolderId,
  resolveGoogleDriveFolderPreset,
  suggestPresetForSiteName,
} from "@/lib/google-drive/google-drive-folder-presets";
import {
  googleDriveFolderIsConfigured,
  resolveGoogleDriveFolder,
} from "@/lib/google-drive/resolve-google-drive-folder";
import type { GoogleDriveFolderSource, TaskExecutionPayload } from "@/lib/tasks-types";
import { cn } from "@/lib/utils";

const FORGE_FIELD_TRIGGER =
  "h-9 w-full min-w-0 border-0 bg-black text-white text-base font-medium shadow-none ring-0 outline-none focus:ring-2 focus:ring-primary/45 focus:ring-offset-0 [&>span]:text-white";
const FORGE_FIELD_INPUT =
  "h-9 w-full min-w-0 border-0 bg-black text-white text-base font-medium shadow-none ring-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-0";
const FORGE_SELECT_CONTENT = "z-[200] border-0 bg-zinc-900 text-white shadow-xl";
const FORGE_SELECT_ITEM =
  "text-base focus:bg-zinc-800 focus:text-white data-[highlighted]:bg-zinc-800 data-[highlighted]:text-white";

const CUSTOM_FOLDER = "custom";
const FOLDER_PATH_PLACEHOLDER = "https://drive.google.com/drive/folders/…";

const FOLDER_SOURCE_OPTIONS: { value: GoogleDriveFolderSource; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "client_root", label: "Client folder" },
  { value: "path", label: "Path" },
  { value: "variable", label: "Variable" },
];

function folderPathFromPayload(payload: TaskExecutionPayload): string {
  const folderId = String(payload.googleDriveFolderId ?? "").trim();
  if (!folderId) return "";
  return formatGoogleDriveFolderUrl(folderId) || folderId;
}

function resolveFolderSource(payload: TaskExecutionPayload): GoogleDriveFolderSource {
  const source = payload.googleDriveFolderSource;
  if (source === "client_root" || source === "path" || source === "variable") return source;
  return "manual";
}

export type DriveFolderVariableOption = {
  key: string;
  label: string;
};

export type AutomationGoogleDriveFieldsProps = {
  payload: TaskExecutionPayload;
  disabled?: boolean;
  siteName?: string;
  siteUrl?: string;
  executionKind?: string;
  layout?: "stack" | "workflow";
  inferredFolderPath?: string;
  folderVariableOptions?: DriveFolderVariableOption[];
  onChange: (patch: Partial<TaskExecutionPayload>) => void;
};

type WorkflowDriveFolderPreviewState = {
  label: string;
  webViewLink: string;
  loading: boolean;
  error: string;
};

function WorkflowDriveFolderPreview({
  payload,
  siteName,
  siteUrl,
  executionKind,
  connected,
  disabled,
}: {
  payload: TaskExecutionPayload;
  siteName: string;
  siteUrl: string;
  executionKind?: string;
  connected: boolean;
  disabled: boolean;
}): React.ReactElement | null {
  const [preview, setPreview] = useState<WorkflowDriveFolderPreviewState>({
    label: "",
    webViewLink: "",
    loading: false,
    error: "",
  });

  const storedFolderId = parseGoogleDriveFolderId(String(payload.googleDriveTargetFolderId ?? ""));
  const storedLabel = String(payload.googleDriveFolderLabel ?? "").trim();
  const storedLink = storedFolderId ? formatGoogleDriveFolderUrl(storedFolderId) : "";

  useEffect(() => {
    if (disabled || !connected) {
      setPreview({ label: "", webViewLink: "", loading: false, error: "" });
      return;
    }
    const trimmedSite = siteName.trim();
    if (!trimmedSite) {
      setPreview({ label: "", webViewLink: "", loading: false, error: "" });
      return;
    }
    if (!googleDriveFolderIsConfigured(payload, trimmedSite)) {
      setPreview({ label: "", webViewLink: "", loading: false, error: "" });
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPreview((current) => ({ ...current, loading: true, error: "" }));
      resolveGoogleDriveFolder({
        contract: { ...payload, saveToGoogleDrive: true },
        siteName: trimmedSite,
        siteUrl: siteUrl.trim() || undefined,
        executionKind,
      })
        .then((resolved) => {
          if (cancelled) return;
          if (!resolved?.folderId) {
            setPreview({ label: "", webViewLink: "", loading: false, error: "Could not resolve folder." });
            return;
          }
          setPreview({
            label: resolved.label.trim(),
            webViewLink: resolved.webViewLink?.trim() || formatGoogleDriveFolderUrl(resolved.folderId),
            loading: false,
            error: "",
          });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const message = err instanceof Error ? err.message.trim() : "Could not resolve folder.";
          setPreview({ label: "", webViewLink: "", loading: false, error: message });
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    connected,
    disabled,
    executionKind,
    payload.googleDriveFolderMonth,
    payload.googleDriveFolderPath,
    payload.googleDriveFolderPathManual,
    payload.googleDriveFolderSource,
    payload.googleDriveFolderYear,
    payload.googleDrivePresetKey,
    payload.googleDriveFolderId,
    payload.googleDriveFolderVariable,
    payload.saveToGoogleDrive,
    siteName,
    siteUrl,
  ]);

  const link = preview.webViewLink || storedLink;
  const label = preview.label || storedLabel;

  if (!connected) return null;

  if (preview.loading && !link) {
    return <p className="min-w-0 truncate text-base text-muted-foreground">Resolving folder…</p>;
  }

  if (preview.error && !link) {
    return (
      <p className="min-w-0 truncate text-base text-[hsl(var(--semantic-warning-foreground))]" title={preview.error}>
        {preview.error}
      </p>
    );
  }

  if (!siteName.trim()) {
    return <p className="min-w-0 truncate text-base text-muted-foreground">Select a client to preview the folder.</p>;
  }

  if (!link) return null;

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="min-w-0 truncate text-base text-primary underline-offset-2 hover:underline"
      title={label || link}
    >
      {label || "Open folder"}
    </a>
  );
}

export function GoogleDriveConnectionInline(): React.ReactElement | null {
  const { connected, loading, email } = useGoogleDriveConnectionStatus();
  if (loading) return null;
  if (connected) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5 text-base font-medium text-green-400">
        <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">Google Drive connected{email ? ` (${email})` : ""}</span>
      </span>
    );
  }
  return (
    <Button
      type="button"
      variant="outline"
      className="h-8 shrink-0 rounded-none border-0 bg-black px-2 text-base font-medium text-white hover:bg-zinc-950"
      onClick={openGoogleDriveAuthorize}
    >
      Connect Google Drive
    </Button>
  );
}

export function AutomationGoogleDriveFields({
  payload,
  disabled = false,
  siteName = "",
  siteUrl = "",
  executionKind,
  layout = "stack",
  inferredFolderPath = "",
  folderVariableOptions = [],
  onChange,
}: AutomationGoogleDriveFieldsProps): React.ReactElement {
  const workflow = layout === "workflow";
  const { connected, loading, email } = useGoogleDriveConnectionStatus();
  const presets = useMemo(() => listGoogleDriveFolderPresets(), []);
  const presetKey = String(payload.googleDrivePresetKey ?? "").trim();
  const folderSource = resolveFolderSource(payload);
  const [folderPathInput, setFolderPathInput] = useState(() => folderPathFromPayload(payload));
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const fromPayload = folderPathFromPayload(payload);
    if (fromPayload && fromPayload !== folderPathInput) {
      setFolderPathInput(fromPayload);
    }
  }, [payload.googleDriveFolderId, payload.googleDrivePresetKey]);

  useEffect(() => {
    if (workflow) return;
    if (folderSource !== "manual") return;
    if (presetKey || payload.googleDriveFolderId || !siteName.trim()) return;
    const suggested = suggestPresetForSiteName(siteName);
    if (!suggested) return;
    onChangeRef.current({
      googleDriveFolderSource: "manual",
      googleDrivePresetKey: suggested.id,
      googleDriveFolderId: suggested.folderId,
      googleDriveFolderLabel: suggested.label,
      saveToGoogleDrive: true,
    });
    setFolderPathInput(formatGoogleDriveFolderUrl(suggested.folderId));
  }, [folderSource, payload.googleDriveFolderId, presetKey, siteName, workflow]);

  useEffect(() => {
    if (!workflow) return;
    const inferred = inferredFolderPath || "reporting";
    const year = String(payload.googleDriveFolderYear ?? "").trim();
    const month = String(payload.googleDriveFolderMonth ?? "").trim();
    const seededYear = isDriveCalendarYear(year) ? year : formatDriveYearSegment();
    const seededMonth = isDriveCalendarMonth(month) ? month : formatDriveMonthSegment();
    const calendarPatch =
      seededYear !== year || seededMonth !== month
        ? { googleDriveFolderYear: seededYear, googleDriveFolderMonth: seededMonth }
        : {};
    if (payload.googleDriveFolderPathManual === true) {
      if (
        payload.googleDriveFolderSource === "path" &&
        payload.saveToGoogleDrive === true &&
        Object.keys(calendarPatch).length === 0
      ) {
        return;
      }
      onChangeRef.current({
        googleDriveFolderSource: "path",
        saveToGoogleDrive: true,
        ...calendarPatch,
      });
      return;
    }
    if (
      payload.googleDriveFolderSource === "path" &&
      payload.googleDriveFolderPath === inferred &&
      payload.saveToGoogleDrive === true &&
      Object.keys(calendarPatch).length === 0
    ) {
      return;
    }
    onChangeRef.current({
      googleDriveFolderSource: "path",
      googleDriveFolderPath: inferred,
      googleDriveFolderPathManual: false,
      saveToGoogleDrive: true,
      ...calendarPatch,
    });
  }, [
    inferredFolderPath,
    payload.googleDriveFolderPath,
    payload.googleDriveFolderPathManual,
    payload.googleDriveFolderMonth,
    payload.googleDriveFolderSource,
    payload.googleDriveFolderYear,
    payload.saveToGoogleDrive,
    workflow,
  ]);

  const resolvedFolder =
    folderSource === "manual"
      ? resolveGoogleDriveFolderPreset(
          presetKey || CUSTOM_FOLDER,
          payload.googleDriveFolderId ?? parseGoogleDriveFolderId(folderPathInput),
        )
      : null;

  const patch = (partial: Partial<TaskExecutionPayload>) => {
    onChange(partial);
  };

  const patchFolderSource = (source: GoogleDriveFolderSource) => {
    if (source === "client_root") {
      patch({
        googleDriveFolderSource: source,
        saveToGoogleDrive: true,
      });
      return;
    }
    if (source === "path") {
      patch({
        googleDriveFolderSource: source,
        googleDriveFolderPath: payload.googleDriveFolderPath ?? GOOGLE_DRIVE_PATH_PRESETS[0]?.value ?? "reporting",
        saveToGoogleDrive: true,
      });
      return;
    }
    if (source === "variable") {
      patch({
        googleDriveFolderSource: source,
        googleDriveFolderVariable:
          payload.googleDriveFolderVariable ?? folderVariableOptions[0]?.key ?? "",
        saveToGoogleDrive: true,
      });
      return;
    }
    patch({ googleDriveFolderSource: source });
  };

  const applyPreset = (nextKey: string) => {
    if (nextKey === CUSTOM_FOLDER) {
      patch({
        googleDriveFolderSource: "manual",
        googleDrivePresetKey: CUSTOM_FOLDER,
        googleDriveFolderLabel: "Custom folder",
      });
      return;
    }
    const preset = presets.find((item) => item.id === nextKey);
    if (!preset) return;
    const folderUrl = formatGoogleDriveFolderUrl(preset.folderId);
    setFolderPathInput(folderUrl);
    patch({
      googleDriveFolderSource: "manual",
      googleDrivePresetKey: preset.id,
      googleDriveFolderId: preset.folderId,
      googleDriveFolderLabel: preset.label,
      saveToGoogleDrive: true,
    });
  };

  const applyFolderPath = (value: string) => {
    setFolderPathInput(value);
    const folderId = parseGoogleDriveFolderId(value);
    const matchedPreset = folderId ? findGoogleDriveFolderPresetByFolderId(folderId) : null;
    patch({
      googleDriveFolderSource: "manual",
      googleDrivePresetKey: matchedPreset?.id ?? CUSTOM_FOLDER,
      googleDriveFolderId: folderId,
      googleDriveFolderLabel: matchedPreset?.label ?? "Custom folder",
      saveToGoogleDrive: Boolean(folderId),
    });
  };

  const selectValue =
    presetKey && presetKey !== CUSTOM_FOLDER
      ? presetKey
      : parseGoogleDriveFolderId(folderPathInput)
        ? CUSTOM_FOLDER
        : undefined;

  const configured = googleDriveFolderIsConfigured(payload, siteName);
  const yearLabel = formatDriveYearSegment();
  const monthLabel = formatDriveMonthSegment();

  if (workflow) {
    const inferred = (inferredFolderPath || "reporting") as GoogleDriveFolderPurposeKey;
    const selected =
      payload.googleDriveFolderPathManual === true &&
      payload.googleDriveFolderPath &&
      GOOGLE_DRIVE_PATH_PRESETS.some((item) => item.value === payload.googleDriveFolderPath)
        ? (payload.googleDriveFolderPath as GoogleDriveFolderPurposeKey)
        : inferred;
    const selectedYear = isDriveCalendarYear(String(payload.googleDriveFolderYear ?? "").trim())
      ? String(payload.googleDriveFolderYear).trim()
      : yearLabel;
    const selectedMonth = isDriveCalendarMonth(String(payload.googleDriveFolderMonth ?? "").trim())
      ? String(payload.googleDriveFolderMonth).trim()
      : monthLabel;
    const yearOptions = driveYearSelectOptions();
    if (!yearOptions.includes(selectedYear)) yearOptions.unshift(selectedYear);
    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2">
        <Select
          value={selected}
          onValueChange={(value) =>
            patch({
              googleDriveFolderSource: "path",
              googleDriveFolderPath: value,
              googleDriveFolderPathManual: value !== inferred,
              googleDriveFolderYear: selectedYear,
              googleDriveFolderMonth: selectedMonth,
              saveToGoogleDrive: true,
            })
          }
          disabled={disabled}
        >
          <SelectTrigger
            id="automation-drive-folder-purpose"
            className={FORGE_FIELD_TRIGGER}
            aria-label="Purpose"
          >
            <SelectValue placeholder="Purpose" />
          </SelectTrigger>
          <SelectContent className={FORGE_SELECT_CONTENT}>
            {GOOGLE_DRIVE_PATH_PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={preset.value} className={FORGE_SELECT_ITEM}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={selectedYear}
          onValueChange={(value) =>
            patch({
              googleDriveFolderSource: "path",
              googleDriveFolderYear: value,
              googleDriveFolderMonth: selectedMonth,
              saveToGoogleDrive: true,
            })
          }
          disabled={disabled}
        >
          <SelectTrigger
            id="automation-drive-folder-year"
            className={FORGE_FIELD_TRIGGER}
            aria-label="Year"
          >
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent className={FORGE_SELECT_CONTENT}>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={year} className={FORGE_SELECT_ITEM}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={selectedMonth}
          onValueChange={(value) =>
            patch({
              googleDriveFolderSource: "path",
              googleDriveFolderYear: selectedYear,
              googleDriveFolderMonth: value,
              saveToGoogleDrive: true,
            })
          }
          disabled={disabled}
        >
          <SelectTrigger
            id="automation-drive-folder-month"
            className={FORGE_FIELD_TRIGGER}
            aria-label="Month"
          >
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent className={FORGE_SELECT_CONTENT}>
            {DRIVE_MONTH_SEGMENTS.map((month) => (
              <SelectItem key={month} value={month} className={FORGE_SELECT_ITEM}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>
        <WorkflowDriveFolderPreview
          payload={payload}
          siteName={siteName}
          siteUrl={siteUrl}
          executionKind={executionKind}
          connected={connected}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", !workflow && "pt-1")}>
      {!workflow && !loading && connected ? (
        <span className="inline-flex h-9 w-fit items-center gap-1.5 text-base font-medium text-green-400">
          <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
          Google Drive connected{email ? ` (${email})` : ""}
        </span>
      ) : !workflow && !loading ? (
        <Button
          type="button"
          variant="outline"
          className="h-9 w-fit rounded-none border-0 bg-black px-3 text-base font-medium text-white hover:bg-zinc-950"
          onClick={openGoogleDriveAuthorize}
        >
          Connect Google Drive
        </Button>
      ) : null}

      <div className="min-w-0">
        <Label className="mb-1 block text-base text-muted-foreground">Folder source</Label>
        <div className="flex min-w-0 flex-wrap items-center gap-1" role="group" aria-label="Folder source">
          {FOLDER_SOURCE_OPTIONS.map((option) => (
            <WorkspacePill
              key={option.value}
              label={option.label}
              square
              tone={workflow ? "forge" : "default"}
              active={folderSource === option.value}
              disabled={disabled}
              onClick={() => patchFolderSource(option.value)}
            />
          ))}
        </div>
      </div>

      {folderSource === "manual" ? (
        <>
          <div className="min-w-0">
            <Label htmlFor="automation-drive-folder-path" className="mb-1 block text-base text-muted-foreground">
              Folder path
            </Label>
            <Input
              id="automation-drive-folder-path"
              className={FORGE_FIELD_INPUT}
              placeholder={FOLDER_PATH_PLACEHOLDER}
              value={folderPathInput}
              disabled={disabled}
              onChange={(event) => applyFolderPath(event.target.value)}
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor="automation-drive-folder-preset" className="mb-1 block text-base text-muted-foreground">
              Saved folder
            </Label>
            <Select value={selectValue} onValueChange={applyPreset} disabled={disabled}>
              <SelectTrigger
                id="automation-drive-folder-preset"
                className={FORGE_FIELD_TRIGGER}
                aria-label="Google Drive saved folder"
              >
                <SelectValue placeholder="Pick a saved folder (optional)" />
              </SelectTrigger>
              <SelectContent className={FORGE_SELECT_CONTENT}>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id} className={FORGE_SELECT_ITEM}>
                    {preset.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_FOLDER} className={FORGE_SELECT_ITEM}>
                  Custom folder
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      ) : null}

      {folderSource === "client_root" ? (
        <p className="text-base text-muted-foreground">
          Auto-find the client folder under NEO Pulse.
          {siteName.trim() ? ` Client: ${siteName.trim()}.` : " Select a client to preview the match."}
        </p>
      ) : null}

      {folderSource === "path" ? (
        <div className="min-w-0">
          <Label htmlFor="automation-drive-folder-purpose" className="mb-1 block text-base text-muted-foreground">
            Purpose path
          </Label>
          <Select
            value={payload.googleDriveFolderPath ?? GOOGLE_DRIVE_PATH_PRESETS[0]?.value ?? "reporting"}
            onValueChange={(value) =>
              patch({ googleDriveFolderPath: value, googleDriveFolderSource: "path", saveToGoogleDrive: true })
            }
            disabled={disabled}
          >
            <SelectTrigger id="automation-drive-folder-purpose" className={FORGE_FIELD_TRIGGER}>
              <SelectValue placeholder="Pick a purpose folder" />
            </SelectTrigger>
            <SelectContent className={FORGE_SELECT_CONTENT}>
              {GOOGLE_DRIVE_PATH_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value} className={FORGE_SELECT_ITEM}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {folderSource === "variable" ? (
        <TaskFormInfieldSelect
          label="Folder variable"
          value={payload.googleDriveFolderVariable ?? ""}
          disabled={disabled || folderVariableOptions.length === 0}
          options={folderVariableOptions.map((option) => ({
            value: option.key,
            label: option.label || option.key,
          }))}
          onChange={(value) =>
            patch({ googleDriveFolderVariable: value, googleDriveFolderSource: "variable", saveToGoogleDrive: true })
          }
        />
      ) : null}

      {configured ? (
        <p className="text-base text-muted-foreground">
          {folderSource === "manual" && resolvedFolder
            ? `Saves to ${resolvedFolder.label} (${resolvedFolder.folderId.slice(0, 8)}…)`
            : folderSource === "client_root"
              ? "Saves to the client folder under NEO Pulse."
              : folderSource === "path"
                ? `Saves to ${googleDrivePurposeFolderLabel((payload.googleDriveFolderPath || "reporting") as GoogleDriveFolderPurposeKey)} / ${yearLabel} / ${monthLabel} under the client folder.`
                : "Saves to the folder from the selected upstream variable."}
        </p>
      ) : (
        <p className="text-base text-amber-500">
          {folderSource === "manual"
            ? "Folder path is required. Pick a saved folder or paste a URL."
            : folderSource === "variable" && folderVariableOptions.length === 0
              ? "Add an upstream step with a folder output before using a variable."
              : "Configure the folder source before running."}
        </p>
      )}
    </div>
  );
}
