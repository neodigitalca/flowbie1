import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_FORM_FLAT_CONTROL_CLASS,
  TASK_FORM_SELECT_CONTENT_CLASS,
  TASK_FORM_SELECT_ITEM_CLASS,
  TASK_FORM_SELECT_TRIGGER_CLASS,
  TaskFormCompactCell,
  TaskFormFieldGrid,
  TaskFormFlatGrid,
  TaskFormInfield,
  TaskFormInfieldSelect,
  TaskFormPanel,
} from "@/components/manager/tasks/TaskFormLayout";
import { PulseForgePostSchedulePanel } from "@/components/manager/tasks/planner/PulseForgePostSchedulePanel";
import { ensurePostCreatorPayload } from "@/lib/post-creator/post-creator-defaults";
import type { TaskExecutionPayload } from "@/lib/tasks-types";

const INLINE_INPUT_CLASS = "h-9 min-h-9 rounded-none border-0 bg-transparent p-0 text-base text-white shadow-none outline-none ring-0 focus-visible:ring-0";

export type PostCreatorExecutionFieldsProps = {
  executionPayload?: TaskExecutionPayload | null;
  disabled?: boolean;
  layout?: "stack" | "inline";
  surface?: "default" | "what";
  onChange: (payload: TaskExecutionPayload) => void;
};

function normalizeWhatKeywordSource(source: TaskExecutionPayload["keywordSource"]): "gsc" | "manual" {
  return source === "manual" ? "manual" : "gsc";
}

export function PostCreatorExecutionFields({
  executionPayload,
  disabled = false,
  layout = "stack",
  surface = "default",
  onChange,
}: PostCreatorExecutionFieldsProps): React.ReactElement {
  const payload = ensurePostCreatorPayload(executionPayload);
  const inline = layout === "inline";
  const whatSurface = surface === "what";

  const patch = (partial: Partial<TaskExecutionPayload>) => {
    onChange(ensurePostCreatorPayload({ ...payload, ...partial }));
  };

  const postCount = payload.postCount ?? 1;
  const keywordSource = whatSurface
    ? normalizeWhatKeywordSource(payload.keywordSource)
    : (payload.keywordSource ?? "prompt");

  if (whatSurface) {
    return (
      <div className="flex flex-col gap-3">
        <TaskFormPanel title="Posts">
          <TaskFormInfield label="Posts per run">
            <Input
              type="number"
              min={1}
              max={31}
              value={postCount}
              disabled={disabled}
              className={TASK_FORM_FLAT_CONTROL_CLASS}
              onChange={(e) => patch({ postCount: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })}
            />
          </TaskFormInfield>
        </TaskFormPanel>
        <TaskFormPanel title="Keywords">
          <TaskFormFieldGrid>
            <TaskFormInfieldSelect
              label="Keyword source"
              value={keywordSource}
              disabled={disabled}
              options={[
                { value: "gsc", label: "GSC performers" },
                { value: "manual", label: "Manual list" },
              ]}
              onChange={(v) =>
                patch({
                  keywordSource: v as TaskExecutionPayload["keywordSource"],
                  optionalPrompt: undefined,
                })
              }
            />
            {keywordSource === "manual" ? (
              <TaskFormInfield label="Manual keyword">
                <Input
                  value={payload.keywordValue ?? ""}
                  disabled={disabled}
                  className={TASK_FORM_FLAT_CONTROL_CLASS}
                  onChange={(e) => patch({ keywordValue: e.target.value })}
                />
              </TaskFormInfield>
            ) : null}
          </TaskFormFieldGrid>
        </TaskFormPanel>
        <TaskFormPanel title="Featured image">
          <label className="flex min-w-0 items-center gap-2">
            <Checkbox
              id="post-creator-featured-what"
              checked={payload.featuredImage !== false}
              disabled={disabled}
              onCheckedChange={(checked) => patch({ featuredImage: checked === true })}
            />
            <span className="text-base text-white">AI featured image</span>
          </label>
        </TaskFormPanel>
      </div>
    );
  }

  if (inline) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-1">
        <TaskFormFlatGrid className="grid-cols-4">
          <TaskFormCompactCell label="Posts per run">
            <Input
              type="number"
              min={1}
              max={31}
              value={postCount}
              disabled={disabled}
              className={INLINE_INPUT_CLASS}
              onChange={(e) => patch({ postCount: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })}
            />
          </TaskFormCompactCell>
          <TaskFormCompactCell label="Keyword source">
            <Select
              value={keywordSource}
              onValueChange={(v) => patch({ keywordSource: v as TaskExecutionPayload["keywordSource"] })}
              disabled={disabled}
            >
              <SelectTrigger className={TASK_FORM_SELECT_TRIGGER_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={TASK_FORM_SELECT_CONTENT_CLASS}>
                <SelectItem value="prompt" className={TASK_FORM_SELECT_ITEM_CLASS}>
                  AI ideas
                </SelectItem>
                <SelectItem value="gsc" className={TASK_FORM_SELECT_ITEM_CLASS}>
                  GSC performers
                </SelectItem>
                <SelectItem value="manual" className={TASK_FORM_SELECT_ITEM_CLASS}>
                  Manual list
                </SelectItem>
              </SelectContent>
            </Select>
          </TaskFormCompactCell>
          <TaskFormCompactCell label="Destination">
            <Select
              value={payload.postDestination ?? "wordpress"}
              onValueChange={(v) => patch({ postDestination: v as TaskExecutionPayload["postDestination"] })}
              disabled={disabled}
            >
              <SelectTrigger className={TASK_FORM_SELECT_TRIGGER_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={TASK_FORM_SELECT_CONTENT_CLASS}>
                <SelectItem value="wordpress" className={TASK_FORM_SELECT_ITEM_CLASS}>
                  WordPress schedule
                </SelectItem>
                <SelectItem value="draft" className={TASK_FORM_SELECT_ITEM_CLASS}>
                  Draft only
                </SelectItem>
              </SelectContent>
            </Select>
          </TaskFormCompactCell>
          <TaskFormCompactCell label="Featured image">
            <label className="flex h-9 min-w-0 items-center gap-2">
              <Checkbox
                id="post-creator-featured-inline"
                checked={payload.featuredImage !== false}
                disabled={disabled}
                onCheckedChange={(checked) => patch({ featuredImage: checked === true })}
              />
              <span className="text-base text-white">AI featured image</span>
            </label>
          </TaskFormCompactCell>
        </TaskFormFlatGrid>
        <TaskFormCompactCell
          label="Topic prompt"
          hidden={keywordSource !== "prompt"}
          className="min-h-[4.5rem]"
        >
          <Textarea
            value={payload.optionalPrompt ?? ""}
            disabled={disabled || keywordSource !== "prompt"}
            rows={2}
            className="min-h-[2.5rem] resize-none rounded-none border-0 bg-transparent p-0 text-base text-white shadow-none outline-none ring-0 focus-visible:ring-0"
            onChange={(e) => patch({ optionalPrompt: e.target.value })}
          />
        </TaskFormCompactCell>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <TaskFormFieldGrid>
        <TaskFormInfield label="Posts per run">
          <Input
            type="number"
            min={1}
            max={31}
            value={postCount}
            disabled={disabled}
            className="bg-zinc-900 text-base"
            onChange={(e) => patch({ postCount: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })}
          />
        </TaskFormInfield>
      </TaskFormFieldGrid>
      <PulseForgePostSchedulePanel
        executionKind="post_creator"
        executionPayload={payload}
        disabled={disabled}
        onChange={onChange}
      />
      <TaskFormFieldGrid>
        <TaskFormInfieldSelect
          label="Keyword source"
          value={keywordSource}
          disabled={disabled}
          options={[
            { value: "prompt", label: "AI ideas" },
            { value: "gsc", label: "GSC performers" },
            { value: "manual", label: "Manual list" },
          ]}
          onChange={(v) => patch({ keywordSource: v as TaskExecutionPayload["keywordSource"] })}
        />
        <TaskFormInfieldSelect
          label="Destination"
          value={payload.postDestination ?? "wordpress"}
          disabled={disabled}
          options={[
            { value: "wordpress", label: "WordPress schedule" },
            { value: "draft", label: "Draft only" },
          ]}
          onChange={(v) => patch({ postDestination: v as TaskExecutionPayload["postDestination"] })}
        />
      </TaskFormFieldGrid>
      {keywordSource === "prompt" ? (
        <TaskFormInfield label="Topic prompt">
          <Textarea
            value={payload.optionalPrompt ?? ""}
            disabled={disabled}
            rows={2}
            className="bg-zinc-900 text-base"
            onChange={(e) => patch({ optionalPrompt: e.target.value })}
          />
        </TaskFormInfield>
      ) : null}
      <div className="flex items-center gap-2">
        <Checkbox
          id="post-creator-featured-stack"
          checked={payload.featuredImage !== false}
          disabled={disabled}
          onCheckedChange={(checked) => patch({ featuredImage: checked === true })}
        />
        <label htmlFor="post-creator-featured-stack" className="text-base text-white">
          AI featured image
        </label>
      </div>
      <p className="text-base text-muted-foreground">Target bucket: Posts</p>
    </div>
  );
}
